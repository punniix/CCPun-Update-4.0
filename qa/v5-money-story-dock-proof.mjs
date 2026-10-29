import { createHash } from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
// C12: exact post-mount presentation effects only, no engine/game JSX/copy changes.
export const moneyStoryDockSources = Object.freeze({
  "features/money-story/components/MoneyStoryGame.tsx": {
    "before": "96e97b9614a779569cd0da7aafdd839d3379e9d652858551ec29bce7306a4e4c",
    "after": "fad38a6834849969121ffee8b7728ae827caf7186a6303cdf915c9bef95b9ed0",
    "changes": [
      [
        "\n  useEffect(() => {\n    // Presentation state only: selected, playing and final-result screens own their LINE action.\n    // The initial SSR tree stays unchanged; reset/unmount releases the floating dock.\n    const root = document.documentElement;\n    const sync = () => window.dispatchEvent(new Event('ccpun:money-story-dock'));\n    if (game || selectedCharacterId) root.setAttribute('data-money-story-dock-hidden', '');\n    else root.removeAttribute('data-money-story-dock-hidden');\n    sync();\n    return () => { root.removeAttribute('data-money-story-dock-hidden'); sync(); };\n  }, [game, selectedCharacterId]);\n",
        ""
      ]
    ]
  },
  "components/layout/v5/V5ChatDock.tsx": {
    "before": "cfdd0ea2065ab6aef4e15519cd794f390e437e3ae3d1953a6e751788d96f3c6c",
    "after": "d764631257b1eedc6fad5f89d29e489719731b8ed4f6a273f1a508873ae2bea7",
    "changes": [
      [
        "  const [moneyStoryHidden, setMoneyStoryHidden] = useState(false);\n",
        ""
      ],
      [
        "\n  useEffect(() => {\n    // Read on mount as well as notifications: sibling effects may mount in either order.\n    const sync = () => setMoneyStoryHidden(document.documentElement.hasAttribute('data-money-story-dock-hidden'));\n    window.addEventListener('ccpun:money-story-dock', sync);\n    sync();\n    return () => window.removeEventListener('ccpun:money-story-dock', sync);\n  }, []);\n",
        ""
      ],
      [
        "        <div ref={dockRef} className={styles.dock} data-state={state} data-v5-chat-dock=\"\" hidden={moneyStoryHidden || undefined} inert={moneyStoryHidden || undefined} aria-hidden={moneyStoryHidden || undefined}>\n",
        "        <div ref={dockRef} className={styles.dock} data-state={state} data-v5-chat-dock=\"\">\n"
      ],
      [
        "      <div ref={dockRef} className={styles.dock} data-state={state} data-v5-chat-dock=\"\" hidden={moneyStoryHidden || undefined} inert={moneyStoryHidden || undefined} aria-hidden={moneyStoryHidden || undefined}>\n",
        "      <div ref={dockRef} className={styles.dock} data-state={state} data-v5-chat-dock=\"\">\n"
      ]
    ]
  }
});
export function moneyStoryDockPredecessor(file, source) {
  const entry = moneyStoryDockSources[file];
  if (!Object.hasOwn(moneyStoryDockSources, file) || sha(source) !== entry.after) return source;
  for (const [current, prior] of entry.changes) {
    if (source.split(current).length !== 2) throw new Error('Money Story dock inverse must be exact and unique');
    source = source.replace(current, prior);
  }
  if (sha(source) !== entry.before) throw new Error('Money Story dock predecessor mismatch');
  return source;
}
