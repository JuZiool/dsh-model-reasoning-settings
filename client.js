window.__ModuleLoader__.load({
  id: '@local/dsh-model-reasoning-settings',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'dsh-model-reasoning-settings';
    const LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
    const DICTIONARIES = {
      zh: {
        defaultLabel: '默认思考等级',
        defaultHelp: '新会话在没有单独选择等级时使用此值。仅对模型支持的等级生效。',
        inherit: '沿用提供商默认',
        off: '关闭思考',
        minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High（推荐）', xhigh: 'XHigh', max: 'Max',
        manualModels: '手动配置的模型',
        modelHelp: '开启后，模型选择器会提供 High 等级。接口值默认是 high；请确认提供商支持，必要时修改。',
        enableHigh: '声明支持 High 思考等级', wireValue: '接口等级值', loading: '正在读取模型配置…', saving: '正在保存…', saved: '已保存',
        readOnly: '当前配置不可写。', loadError: '读取设置失败：{message}', saveError: '保存失败：{message}',
        emptyWireValue: '接口等级值不能为空。',
      },
      en: {
        defaultLabel: 'Default reasoning level',
        defaultHelp: 'Used for new sessions when no level is selected explicitly. Only supported model levels work.',
        inherit: 'Use provider default', off: 'Thinking off',
        minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High (recommended)', xhigh: 'XHigh', max: 'Max',
        manualModels: 'Manually configured models',
        modelHelp: 'Enabling this adds High to the model selector. The wire value defaults to high; confirm your provider supports it or change it.',
        enableHigh: 'Declare High reasoning support', wireValue: 'Provider wire value', loading: 'Reading model settings…', saving: 'Saving…', saved: 'Saved',
        readOnly: 'The current profile is read-only.', loadError: 'Could not read settings: {message}', saveError: 'Could not save: {message}',
        emptyWireValue: 'The provider wire value cannot be empty.',
      },
    };
    const borderStyle = {
      border: '1px solid currentColor',
      borderRadius: 8,
      marginTop: 10,
      opacity: 0.9,
      padding: 12,
    };
    const fieldStyle = {
      background: 'transparent',
      border: '1px solid currentColor',
      borderRadius: 6,
      color: 'inherit',
      font: 'inherit',
      padding: '6px 8px',
    };

    function message(t, key, params) {
      return t(key, params);
    }

    function ReasoningSettings(props) {
      const { provider, configured, settings, t } = props;
      const [view, setView] = React.useState(null);
      const [writable, setWritable] = React.useState(false);
      const [loading, setLoading] = React.useState(true);
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const [wireDrafts, setWireDrafts] = React.useState({});
      const route = provider && provider.provider;
      const namespace = provider && provider.settingsNs || 'llm-pi-ai';

      const load = React.useCallback(async () => {
        setLoading(true);
        setError('');
        try {
          const result = await settings.describe();
          if (!result.ok) throw new Error(result.error.message || String(result.error));
          const descriptor = result.value.namespaces.find(item => item.ns === namespace);
          if (!descriptor) throw new Error('llm-pi-ai settings are unavailable');
          setWritable(result.value.writable === true);
          setView(descriptor);
          setWireDrafts({});
        } catch (failure) {
          setError(message(t, 'loadError', { message: failure && failure.message || String(failure) }));
        } finally {
          setLoading(false);
        }
      }, [namespace, settings, t]);

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
            const result = await settings.describe();
            if (!result.ok) throw new Error(result.error.message || String(result.error));
            const descriptor = result.value.namespaces.find(item => item.ns === namespace);
            if (!descriptor) throw new Error('llm-pi-ai settings are unavailable');
            if (active) {
              setWritable(result.value.writable === true);
              setView(descriptor);
              setWireDrafts({});
            }
          } catch (failure) {
            if (active) setError(message(t, 'loadError', { message: failure && failure.message || String(failure) }));
          } finally {
            if (active) setLoading(false);
          }
        };
        void run();
        return () => { active = false; };
      }, [configured, namespace, route, settings, t]);

      if (!configured) return null;
      if (loading) return h('div', { style: borderStyle, role: 'status' }, t('loading'));
      if (!view) return error ? h('div', { style: borderStyle, role: 'alert' }, error) : null;

      const root = view.value || {};
      const profile = root.providers && root.providers[route] || {};
      const profilePath = ['providers', route];
      const models = Array.isArray(profile.models)
        ? profile.models.map((model, index) => ({
          id: model.id,
          label: model.name || model.id,
          config: model,
          path: profilePath.concat(['models', String(index)]),
        }))
        : [];
      const overrides = profile.modelOverrides && typeof profile.modelOverrides === 'object'
        ? Object.entries(profile.modelOverrides).map(([id, config]) => ({
          id,
          label: config.name || id,
          config,
          path: profilePath.concat(['modelOverrides', id]),
        }))
        : [];
      const manualModels = models.concat(overrides);

      const save = async (ops) => {
        if (!writable || busy) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
          const result = await settings.mutate(namespace, ops, view.revision);
          if (!result.ok) throw new Error(result.error.message || String(result.error));
          setView(result.value);
          setWireDrafts({});
          setNotice(t('saved'));
        } catch (failure) {
          setError(message(t, 'saveError', { message: failure && failure.message || String(failure) }));
          try {
            const refreshed = await settings.describe();
            if (refreshed.ok) {
              const descriptor = refreshed.value.namespaces.find(item => item.ns === namespace);
              if (descriptor) {
                setView(descriptor);
                setWritable(refreshed.value.writable === true);
              }
            }
          } catch (_) {}
        } finally {
          setBusy(false);
        }
      };

      const updateDefault = (value) => {
        const path = profilePath.concat(['reasoning']);
        void save(value
          ? [{ op: 'set', path, value }]
          : [{ op: 'unset', path }]);
      };

      const updateHigh = (model, enabled, wireValue) => {
        const current = model.config.reasoningEfforts;
        const next = current && typeof current === 'object' && !Array.isArray(current)
          ? { ...current }
          : {};
        if (enabled) {
          const wire = (wireValue || 'high').trim();
          if (!wire) {
            setError(t('emptyWireValue'));
            return;
          }
          if (!Object.prototype.hasOwnProperty.call(next, 'off')) next.off = null;
          next.high = wire;
          void save([{ op: 'set', path: model.path.concat(['reasoningEfforts']), value: next }]);
          return;
        }
        delete next.high;
        const otherLevels = Object.keys(next).filter(level => level !== 'off');
        if (otherLevels.length === 0) {
          void save([{ op: 'unset', path: model.path.concat(['reasoningEfforts']) }]);
        } else {
          void save([{ op: 'set', path: model.path.concat(['reasoningEfforts']), value: next }]);
        }
      };

      const defaultId = 'dsh-reasoning-default-' + String(route).replace(/[^a-zA-Z0-9_-]/g, '-');
      const select = h('select', {
        id: defaultId,
        value: profile.reasoning || '',
        disabled: !writable || busy,
        style: fieldStyle,
        onChange: event => updateDefault(event.target.value),
        'aria-label': t('defaultLabel'),
      }, [
        h('option', { key: 'inherit', value: '' }, t('inherit')),
        ...LEVELS.map(level => h('option', { key: level, value: level }, t(level))),
      ]);

      const renderModel = (model) => {
        const effort = model.config.reasoningEfforts;
        const map = effort && typeof effort === 'object' && !Array.isArray(effort) ? effort : {};
        const enabled = typeof map.high === 'string' && map.high.length > 0;
        const key = model.path.join('.');
        const wire = wireDrafts[key] !== undefined ? wireDrafts[key] : enabled ? map.high : 'high';
        return h('div', {
          key,
          style: { borderTop: '1px solid currentColor', display: 'grid', gap: 6, padding: '8px 0' },
        },
          h('label', { style: { alignItems: 'center', display: 'flex', gap: 8 } },
            h('input', {
              type: 'checkbox',
              checked: enabled,
              disabled: !writable || busy,
              onChange: event => updateHigh(model, event.target.checked, wire),
            }),
            h('span', null, t('enableHigh')),
          ),
          enabled ? h('label', { style: { display: 'grid', gap: 4, maxWidth: 360 } },
            h('span', null, t('wireValue')),
            h('input', {
              type: 'text',
              value: wire,
              disabled: !writable || busy,
              style: fieldStyle,
              onChange: event => setWireDrafts(current => ({ ...current, [key]: event.target.value })),
              onBlur: () => {
                if (enabled && wire !== map.high) updateHigh(model, true, wire);
              },
            }),
          ) : null,
        );
      };

      return h('section', { style: borderStyle, 'aria-label': t('defaultLabel') },
        h('div', { style: { display: 'grid', gap: 6, maxWidth: 420 } },
          h('label', { style: { fontWeight: 600 }, htmlFor: defaultId }, t('defaultLabel')),
          select,
          h('small', null, t('defaultHelp')),
        ),
        manualModels.length
          ? h('div', { style: { marginTop: 14 } },
            h('div', { style: { fontWeight: 600, marginBottom: 6 } }, t('manualModels')),
            h('small', { style: { display: 'block', marginBottom: 8 } }, t('modelHelp')),
            ...manualModels.map(renderModel),
          )
          : h('small', { style: { display: 'block', marginTop: 12 } }, t('noModels')),
        !writable ? h('p', { role: 'status' }, t('readOnly')) : null,
        busy ? h('p', { role: 'status' }, t('saving')) : null,
        notice ? h('p', { role: 'status' }, notice) : null,
        error ? h('p', { role: 'alert' }, error) : null,
      );
    }

    return {
      inject: ['slots', 'remote.settings', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICTIONARIES), 'dsh-model-reasoning-settings: locales');
        ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
          name: 'settings.models.provider-card',
          key: 'llm-pi-ai',
          locale: NS,
          inject: () => ({ settings: ctx.remote.settings }),
        }, ReasoningSettings));
      },
    };
  },
});
