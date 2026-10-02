import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'
import { pathToFileURL } from 'node:url'

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

  let definition
  const clientSource = await readFile('client.js', 'utf8')
  vm.runInNewContext(clientSource, {
    window: { __ModuleLoader__: { load: value => { definition = value } } },
  }, { filename: 'client.js' })
  assert.equal(definition.id, manifest.name)
  assert.equal(typeof definition.factory, 'function')

  const client = definition.factory(moduleName => {
    assert.equal(moduleName, 'react')
    return { createElement() {} }
  })
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
      bind(namespace) {
        calls.push(['bind', namespace])
        return t
      },
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
