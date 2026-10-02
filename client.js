window.__ModuleLoader__.load({
  id: '@local/dsh-model-reasoning-settings',
  factory(require) {
    const React = require('react');
    const { createPortal } = require('react-dom');
    const h = React.createElement;
    const NS = 'dsh-model-reasoning-settings';
    // The levels a model row offers as chips. `off` is the "no thinking"
    // level and never carries a wire value; the rest default their wire
    // spelling to the level id itself.
    const CHIP_LEVELS = ['off', 'medium', 'high', 'xhigh', 'max'];
    const DICTIONARIES = {
      zh: {
        off: 'None', minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'XHigh', max: 'Max',
        draftHint: '点「保存」后写入该模型',
        loading: '正在读取模型配置…', saving: '正在保存…', saved: '已保存',
        readOnly: '当前配置不可写。', loadError: '读取设置失败：{message}', saveError: '保存失败：{message}',
      },
      en: {
        off: 'None', minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'XHigh', max: 'Max',
        draftHint: 'Written to the model when you save the provider',
        loading: 'Reading model settings…', saving: 'Saving…', saved: 'Saved',
        readOnly: 'The current profile is read-only.', loadError: 'Could not read settings: {message}', saveError: 'Could not save: {message}',
      },
    };
    const bodyStyle = { padding: '10px 0 0' };
    const chipStyle = (enabled, clickable) => ({
      background: enabled ? 'CanvasText' : 'transparent',
      border: '1px solid currentColor',
      borderRadius: 999,
      color: enabled ? 'Canvas' : 'inherit',
      cursor: clickable ? 'pointer' : 'default',
      font: 'inherit',
      opacity: enabled ? 1 : 0.55,
      padding: '2px 12px',
    });
    const rowStyle = {
      alignItems: 'center',
      columnGap: 8,
      display: 'flex',
      flexWrap: 'wrap',
      padding: '6px 0',
      rowGap: 4,
    };

    function message(t, key, params) {
      return t(key, params);
    }

    /** The levels one model declares, from its configured reasoningEfforts. */
    function declaredLevels(config) {
      const efforts = config && config.reasoningEfforts;
      if (!efforts || typeof efforts !== 'object' || Array.isArray(efforts)) return new Set();
      return new Set(Object.keys(efforts)
        .filter(level => level !== 'off' && typeof efforts[level] === 'string' && efforts[level].length > 0));
    }

    /** Text inputs of one expanded model entry carry its id and display name. */
    function entryNames(entry) {
      return [...entry.querySelectorAll('input')]
        .filter(input => input.type !== 'checkbox' && input.type !== 'radio')
        .map(input => input.value)
        .filter(value => value && value.length > 0);
    }

    function ReasoningSettings(props) {
      const { provider, configured, settings, t } = props;
      const [view, setView] = React.useState(null);
      const [writable, setWritable] = React.useState(false);
      const [loading, setLoading] = React.useState(true);
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const [notice, setNotice] = React.useState('');
      // Live seats inside the provider editor: the 自定义设置 disclosure holds
      // the default-level control, and every expanded model entry hosts that
      // model's chip row through a portal. A seat exists even for a model the
      // user has not saved yet — its chips then render inert until the save.
      const [detailsEl, setDetailsEl] = React.useState(null);
      const [seats, setSeats] = React.useState([]);
      const route = provider && provider.provider;
      const namespace = provider && provider.settingsNs || 'llm-pi-ai';
      const anchorRef = React.useRef(null);
      const wasOpenRef = React.useRef(false);
      const refreshRef = React.useRef(() => {});
      const flushRef = React.useRef(() => {});
      // Levels picked for models that exist only in the editor's draft. They
      // cannot be written until the provider save materializes the model, so
      // they ride here and flush against the stored config on editor close.
      const pendingRef = React.useRef(new Map());
      const [draftTick, setDraftTick] = React.useState(0);

      // Track the editor's seats. The observer re-scans after host edits
      // (rows expand/collapse, models added); states change only when the
      // discovered seats actually differ, so portal re-renders settle. The
      // first open of an editor refreshes the stored-config snapshot, so
      // freshly saved models turn active without a remount.
      React.useEffect(() => {
        const anchor = anchorRef.current;
        const wrapper = anchor && anchor.parentElement;
        const card = wrapper && wrapper.parentElement;
        if (!card) return undefined;
        const scan = () => {
          const details = card.querySelector('details');
          const open = details !== null && details.open;
          const found = [];
          if (open) {
            for (const fieldset of details.querySelectorAll('fieldset')) {
              const entry = fieldset.parentElement && fieldset.parentElement.parentElement;
              if (!entry) continue;
              const names = entryNames(entry);
              found.push({ el: entry, id: names[0] || '', name: names[1] || names[0] || '' });
            }
          }
          setDetailsEl(current => {
            const next = open ? details : null;
            return current === next ? current : next;
          });
          setSeats(current => {
            const same = current.length === found.length
              && found.every((seat, index) => current[index]
                && current[index].el === seat.el
                && current[index].id === seat.id
                && current[index].name === seat.name);
            return same ? current : found;
          });
          if (open && !wasOpenRef.current) refreshRef.current();
          if (!open && wasOpenRef.current) flushRef.current();
          wasOpenRef.current = open;
        };
        scan();
        const observer = new MutationObserver(() => requestAnimationFrame(scan));
        observer.observe(card, { childList: true, subtree: true });
        return () => observer.disconnect();
      }, []);

      const describe = React.useCallback(async () => {
        const result = await settings.describe();
        if (!result.ok) throw new Error(result.error.message || String(result.error));
        const descriptor = result.value.namespaces.find(item => item.ns === namespace);
        if (!descriptor) throw new Error('llm-pi-ai settings are unavailable');
        return { descriptor, writable: result.value.writable === true };
      }, [namespace, settings]);

      React.useEffect(() => {
        refreshRef.current = async () => {
          try {
            const { descriptor, writable: canWrite } = await describe();
            setView(descriptor);
            setWritable(canWrite);
          } catch (_) {}
        };
      }, [describe]);

      React.useEffect(() => {
        flushRef.current = async () => {
          const pending = pendingRef.current;
          if (pending.size === 0) return;
          const entries = [...pending.entries()];
          pending.clear();
          try {
            let current = await describe();
            // The host's save just committed; retry briefly in case the
            // snapshot races the write.
            for (let attempt = 0; attempt < 3; attempt += 1) {
              const root = current.descriptor.value || {};
              const profile = root.providers && root.providers[route] || {};
              const listed = Array.isArray(profile.models) ? profile.models : [];
              const missing = entries.filter(([id]) => !listed.some(model => model.id === id));
              if (missing.length === 0 || attempt === 2) break;
              await new Promise(resolve => setTimeout(resolve, 500));
              current = await describe();
            }
            for (const [id, levels] of entries) {
              const root = current.descriptor.value || {};
              const profile = root.providers && root.providers[route] || {};
              const listed = Array.isArray(profile.models) ? profile.models : [];
              const index = listed.findIndex(model => model.id === id);
              if (index === -1) continue;
              const path = ['providers', route, 'models', String(index), 'reasoningEfforts'];
              const thinking = [...levels].filter(level => level !== 'off');
              const ops = thinking.length === 0
                ? [{ op: 'unset', path }]
                : [{
                  op: 'set',
                  path,
                  value: { off: null, ...Object.fromEntries(thinking.map(level => [level, level])) },
                }];
              const result = await settings.mutate(namespace, ops, current.descriptor.revision);
              if (result.ok) current = { descriptor: result.value, writable: current.writable };
            }
            setView(current.descriptor);
            setWritable(current.writable);
          } catch (_) {}
        };
      }, [describe, namespace, route, settings]);

      React.useEffect(() => {
        if (!configured || !route) {
          setLoading(false);
          return undefined;
        }
        let active = true;
        const run = async () => {
          setLoading(true);
          setError('');
          try {
            const { descriptor, writable: canWrite } = await describe();
            if (active) {
              setWritable(canWrite);
              setView(descriptor);
            }
          } catch (failure) {
            if (active) setError(message(t, 'loadError', { message: failure && failure.message || String(failure) }));
          } finally {
            if (active) setLoading(false);
          }
        };
        void run();
        return () => { active = false; };
      }, [configured, namespace, route, describe, t]);

      const save = async (ops) => {
        if (!writable || busy) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
          const result = await settings.mutate(namespace, ops, view.revision);
          if (!result.ok) throw new Error(result.error.message || String(result.error));
          setView(result.value);
          setNotice(t('saved'));
        } catch (failure) {
          setError(message(t, 'saveError', { message: failure && failure.message || String(failure) }));
          try {
            const refreshed = await describe();
            setView(refreshed.descriptor);
            setWritable(refreshed.writable);
          } catch (_) {}
        } finally {
          setBusy(false);
        }
      };

      /** Toggle one level chip; the wire spelling keeps any configured value. */
      const toggleLevel = (model, level) => {
        if (!writable || busy) return;
        // `None` means "no thinking at all": clear the model's declaration.
        if (level === 'off') {
          void save([{ op: 'unset', path: model.path.concat(['reasoningEfforts']) }]);
          return;
        }
        const efforts = model.config.reasoningEfforts;
        const configured = efforts && typeof efforts === 'object' && !Array.isArray(efforts) ? efforts : {};
        const enabled = declaredLevels(model.config);
        const wire = configured[level];
        const path = model.path.concat(['reasoningEfforts']);
        if (enabled.has(level)) {
          enabled.delete(level);
        } else {
          enabled.add(level);
        }
        if (enabled.size === 0) {
          void save([{ op: 'unset', path }]);
          return;
        }
        const next = { off: null };
        for (const name of enabled) {
          next[name] = typeof wire === 'string' && name === level && wire.length > 0 ? wire : name;
        }
        void save([{ op: 'set', path, value: next }]);
      };

      /** Park a draft model's chip pick until the provider save lands it. */
      const toggleDraft = (id, level) => {
        if (!writable || busy) return;
        const pending = pendingRef.current;
        if (level === 'off') {
          pending.delete(id);
        } else {
          const set = new Set(pending.get(id) || []);
          if (set.has(level)) {
            set.delete(level);
          } else {
            set.add(level);
          }
          if (set.size === 0) pending.delete(id);
          else pending.set(id, set);
        }
        setDraftTick(current => current + 1);
      };

      const models = (() => {
        if (!view) return [];
        const root = view.value || {};
        const profile = root.providers && root.providers[route] || {};
        const listed = Array.isArray(profile.models)
          ? profile.models.map((model, index) => ({
            id: model.id,
            label: model.name || model.id,
            config: model,
            path: ['providers', route, 'models', String(index)],
          }))
          : [];
        const overrides = profile.modelOverrides && typeof profile.modelOverrides === 'object'
          ? Object.entries(profile.modelOverrides).map(([id, config]) => ({
            id,
            label: config.name || id,
            config,
            path: ['providers', route, 'modelOverrides', id],
          }))
          : [];
        return listed.concat(overrides);
      })();

      const renderChips = (model, seat) => {
        const key = model ? model.path.join('.') : 'draft-' + seat.id;
        const enabled = model
          ? declaredLevels(model.config)
          : (pendingRef.current.get(seat.id) || new Set());
        const clickable = writable && !busy;
        return h('div', {
          key,
          style: rowStyle,
          ...model ? {} : { title: t('draftHint') },
          ...model ? {} : { 'data-draft-tick': draftTick },
        },
          CHIP_LEVELS.map(level => h('button', {
            key: level,
            type: 'button',
            'aria-pressed': enabled.has(level),
            'aria-label': (model ? model.label : seat.id || 'model') + ' ' + t(level),
            disabled: !clickable,
            style: chipStyle(enabled.has(level), clickable),
            onClick: model
              ? () => toggleLevel(model, level)
              : () => toggleDraft(seat.id, level),
          }, t(level))),
        );
      };

      if (!configured) return null;
      if (loading) return h('div', { ref: anchorRef, style: { display: 'none' }, role: 'status' }, t('loading'));
      if (!view) {
        return error
          ? h('div', { ref: anchorRef, role: 'alert' }, error)
          : h('div', { ref: anchorRef, style: { display: 'none' } });
      }

      const panel = h('div', { style: bodyStyle },
        !writable ? h('p', { role: 'status' }, t('readOnly')) : null,
        busy ? h('p', { role: 'status' }, t('saving')) : null,
        notice ? h('p', { role: 'status' }, notice) : null,
        error ? h('p', { role: 'alert' }, error) : null,
      );

      return h('div', { ref: anchorRef, style: { display: 'none' }, 'aria-hidden': true },
        detailsEl ? createPortal(panel, detailsEl) : null,
        ...seats.map((seat, index) => {
          const model = models.find(candidate => candidate.id === seat.id || candidate.label === seat.name) || null;
          return createPortal(renderChips(model, seat), seat.el);
        }),
      );
    }

    return {
      inject: ['slots', 'remote', 'remote.settings', 'remote.session', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICTIONARIES), 'dsh-model-reasoning-settings: locales');
        ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
          name: 'settings.models.provider-card',
          key: 'llm-pi-ai',
          locale: NS,
          inject: () => ({ settings: ctx.remote.settings }),
        }, ReasoningSettings));
        // Keep the session's chosen reasoning effort across model switches:
        // the stock selectors drop it and fall back to the new model's
        // default. Wrap the session remote so a model switch without an
        // explicit effort re-applies the last explicit pick, provided the
        // target model offers that level.
        ctx.effect(() => {
          const session = ctx.remote && ctx.remote.session;
          if (!session || typeof session.selectModel !== 'function') return undefined;
          if (session.selectModel.__dshEffortKeep) return undefined;
          // The namespace exposes each method as a configurable accessor; a
          // plain assignment cannot take. Replace the accessor with the
          // wrapper and restore the original descriptor on disposal.
          const descriptor = Object.getOwnPropertyDescriptor(session, 'selectModel');
          const original = session.selectModel.bind(session);
          const lastPicks = new Map();
          const catalogCache = new Map();
          let catalogPromise = null;
          const effortsOf = async (provider, model) => {
            const key = provider + '/' + model;
            if (catalogCache.has(key)) return catalogCache.get(key);
            try {
              catalogPromise = catalogPromise || Promise.resolve(session.modelCatalog());
              const response = await catalogPromise;
              if (!response || !response.ok) return null;
              let matched = null;
              for (const group of response.value.groups) {
                for (const entry of group.models) {
                  const levels = entry.reasoning && Array.isArray(entry.reasoning.efforts)
                    ? entry.reasoning.efforts.map(effort => effort.id)
                    : [];
                  catalogCache.set(group.id + '/' + entry.id, levels);
                  if (group.id === provider && entry.id === model) matched = levels;
                }
              }
              return matched;
            } catch (_) {
              catalogPromise = null;
              return null;
            }
          };
          const keepEffort = async (args) => {
            const key = args.sessionId;
            const previous = lastPicks.get(key);
            const remembered = previous ? previous.effort : undefined;
            const sameModel = previous !== undefined
              && previous.provider === args.provider
              && previous.model === args.model;
            if (args.reasoningEffort !== undefined) {
              lastPicks.set(key, { provider: args.provider, model: args.model, effort: args.reasoningEffort });
              return original(args);
            }
            if (sameModel) {
              // An explicit effort pick on the current model — including the
              // "provider default" row, which clears the memory.
              lastPicks.set(key, { provider: args.provider, model: args.model, effort: undefined });
              return original(args);
            }
            // A model switch without an explicit effort: re-apply the last
            // pick when the target offers that level, else keep it in memory
            // so switching back re-applies it.
            if (remembered !== undefined) {
              const supported = await effortsOf(args.provider, args.model);
              if (supported === null || supported.includes(remembered)) {
                lastPicks.set(key, { provider: args.provider, model: args.model, effort: remembered });
                return original({ ...args, reasoningEffort: remembered });
              }
            }
            lastPicks.set(key, { provider: args.provider, model: args.model, effort: remembered });
            return original(args);
          };
          keepEffort.__dshEffortKeep = true;
          try {
            Object.defineProperty(session, 'selectModel', {
              configurable: true,
              enumerable: descriptor ? descriptor.enumerable : true,
              writable: true,
              value: keepEffort,
            });
          } catch (error) {
            window.__dshPatch = { ok: false, err: String(error) };
            return undefined;
          }
          return () => {
            try {
              if (descriptor) Object.defineProperty(session, 'selectModel', descriptor);
            } catch (_) {}
          };
        }, 'dsh-model-reasoning-settings: keep effort on model switch');
      },
    };
  },
});
