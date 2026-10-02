import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'
import { pathToFileURL } from 'node:url'


function dependenciesEqual(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
}

function createReactHarness() {
  const hooks = []
  let cursor = 0
  let pendingEffects = []

  const react = {
    createElement(type, props, ...children) {
      return { type, props: { ...(props ?? {}), children } }
    },
    useState(initial) {
      const index = cursor++
      if (!Object.hasOwn(hooks, index)) hooks[index] = { value: typeof initial === 'function' ? initial() : initial }
      const setValue = next => {
        hooks[index].value = typeof next === 'function' ? next(hooks[index].value) : next
      }
      return [hooks[index].value, setValue]
    },
    useCallback(callback, dependencies) {
      const index = cursor++
      const previous = hooks[index]
      if (previous === undefined || !dependenciesEqual(previous.dependencies, dependencies)) {
        hooks[index] = { callback, dependencies }
      }
      return hooks[index].callback
    },
    useEffect(effect, dependencies) {
      const index = cursor++
      const previous = hooks[index]
      if (previous === undefined || !dependenciesEqual(previous.dependencies, dependencies)) {
        pendingEffects.push({ index, effect, cleanup: previous?.cleanup })
        hooks[index] = { dependencies, cleanup: previous?.cleanup }
      }
    },
  }

  return {
    react,
    render(Component, props) {
      cursor = 0
      const tree = Component(props)
      const effects = pendingEffects
      pendingEffects = []
      for (const entry of effects) {
        entry.cleanup?.()
        hooks[entry.index].cleanup = entry.effect()
      }
      return tree
    },
  }
}

function elements(node, predicate, result = []) {
  if (Array.isArray(node)) {
    for (const child of node) elements(child, predicate, result)
    return result
  }
  if (node === null || typeof node !== 'object' || !('type' in node)) return result
  if (predicate(node)) result.push(node)
  elements(node.props?.children, predicate, result)
  return result
}

async function settle() {
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
}

async function loadClient(react) {
  let definition
  const clientSource = await readFile('client.js', 'utf8')
  vm.runInNewContext(clientSource, {
    window: { __ModuleLoader__: { load: value => { definition = value } } },
  }, { filename: 'client.js' })
  return { definition, client: definition.factory(moduleName => {
    assert.equal(moduleName, 'react')
    return react
  }) }
}

test('bundle manifest, host entry, and client registration are loadable', async () => {
  const manifest = JSON.parse(await readFile('package.json', 'utf8'))
  assert.equal(manifest.name, '@local/dsh-model-reasoning-settings')
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.equal(manifest.dsh.client.immediately, true)
  assert.deepEqual(manifest.dsh.client.inject, [
    '@deepseek-ai/dsh-client-ui-settings-models',
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-api-remotes',
  ])

  const patch = await readFile('cordis.patch.yml', 'utf8')
  assert.match(patch, /id: dsh-model-reasoning-settings/)
  assert.match(patch, /name: '@local\/dsh-model-reasoning-settings'/)

  const host = await import(pathToFileURL(`${process.cwd()}/index.js`).href)
  assert.equal(typeof host.apply, 'function')

  const { definition, client } = await loadClient({ createElement() {} })
  assert.equal(definition.id, manifest.name)
  assert.equal(typeof definition.factory, 'function')
  assert.deepEqual(Array.from(client.inject), ['slots', 'remote.settings', 'locale'])
  assert.equal(typeof client.apply, 'function')

  const calls = []
  const t = key => key
  const ctx = {
    effect(callback, label) {
      calls.push(['effect', label])
      return callback()
    },
    locale: {
      register(namespace, dictionaries) {
        calls.push(['register', namespace, dictionaries])
        return () => {}
      },
    },
    remote: { settings: {} },
    slots: {
      inject(slot, callback) {
        calls.push(['inject', slot])
        return callback()
      },
      register(options, component) {
        calls.push(['register-slot', options, component])
        return () => {}
      },
    },
  }
  client.apply(ctx)

  const localeCall = calls.find(call => call[0] === 'register')
  assert.equal(localeCall[1], 'dsh-model-reasoning-settings')
  assert.equal(localeCall[2].zh.high, 'High（推荐）')
  assert.equal(localeCall[2].en.high, 'High (recommended)')

  const slotCall = calls.find(call => call[0] === 'register-slot')
  assert.equal(slotCall[1].name, 'settings.models.provider-card')
  assert.equal(slotCall[1].key, 'llm-pi-ai')
  assert.equal(slotCall[1].locale, 'dsh-model-reasoning-settings')
  assert.equal(typeof slotCall[1].inject, 'function')
  assert.equal(slotCall[1].inject().settings, ctx.remote.settings)
  assert.equal(typeof slotCall[2], 'function')
})


test('Models card writes the provider default and manual-model high mapping through Settings Remote', async () => {
  const view = {
    ns: 'llm-pi-ai',
    revision: 7,
    value: {
      providers: {
        acme: {
          models: [{ id: 'acme-think' }],
        },
      },
    },
  }
  const calls = []
  const settings = {
    async describe() {
      return { ok: true, value: { writable: true, namespaces: [view] } }
    },
    async mutate(namespace, ops, revision) {
      calls.push({ namespace, ops: JSON.parse(JSON.stringify(ops)), revision })
      return { ok: true, value: view }
    },
  }
  const { react, render } = createReactHarness()
  const { client } = await loadClient(react)
  let Component
  client.apply({
    effect: callback => callback(),
    locale: { bind: () => key => key, register: () => () => {} },
    remote: { settings },
    slots: {
      inject: (_slot, callback) => callback(),
      register: (_options, component) => { Component = component; return () => {} },
    },
  })
  assert.equal(typeof Component, 'function')

  const props = {
    provider: { provider: 'acme', settingsNs: 'llm-pi-ai' },
    configured: true,
    settings,
    t: key => key,
  }
  let tree = render(Component, props)
  await settle()
  tree = render(Component, props)

  const selector = elements(tree, element => element.type === 'select')[0]
  assert.ok(selector)
  selector.props.onChange({ target: { value: 'high' } })
  await settle()
  assert.deepEqual(calls.shift(), {
    namespace: 'llm-pi-ai',
    ops: [{ op: 'set', path: ['providers', 'acme', 'reasoning'], value: 'high' }],
    revision: 7,
  })

  tree = render(Component, props)
  const checkbox = elements(tree, element => element.type === 'input' && element.props.type === 'checkbox')[0]
  assert.ok(checkbox)
  checkbox.props.onChange({ target: { checked: true } })
  await settle()
  assert.deepEqual(calls.shift(), {
    namespace: 'llm-pi-ai',
    ops: [{
      op: 'set',
      path: ['providers', 'acme', 'models', '0', 'reasoningEfforts'],
      value: { off: null, high: 'high' },
    }],
    revision: 7,
  })
})


test('manual-model wire mapping rejects an empty value instead of silently restoring high', async () => {
  const view = {
    ns: 'llm-pi-ai',
    revision: 11,
    value: {
      providers: {
        acme: {
          models: [{ id: 'acme-think', reasoningEfforts: { off: null, high: 'high' } }],
        },
      },
    },
  }
  const calls = []
  const settings = {
    async describe() {
      return { ok: true, value: { writable: true, namespaces: [view] } }
    },
    async mutate(...args) {
      calls.push(args)
      return { ok: true, value: view }
    },
  }
  const { react, render } = createReactHarness()
  const { client } = await loadClient(react)
  let Component
  client.apply({
    effect: callback => callback(),
    locale: { register: () => () => {} },
    remote: { settings },
    slots: {
      inject: (_slot, callback) => callback(),
      register: (_options, component) => { Component = component; return () => {} },
    },
  })
  const props = {
    provider: { provider: 'acme', settingsNs: 'llm-pi-ai' },
    configured: true,
    settings,
    t: key => key,
  }
  let tree = render(Component, props)
  await settle()
  tree = render(Component, props)

  let wireInput = elements(tree, element => element.type === 'input' && element.props.type === 'text')[0]
  assert.ok(wireInput)
  wireInput.props.onChange({ target: { value: '' } })
  tree = render(Component, props)
  wireInput = elements(tree, element => element.type === 'input' && element.props.type === 'text')[0]
  wireInput.props.onBlur()
  await settle()
  tree = render(Component, props)

  assert.equal(calls.length, 0)
  const alerts = elements(tree, element => element.props?.role === 'alert')
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].props.children[0], 'emptyWireValue')
})
