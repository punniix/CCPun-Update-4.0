"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { insert, set, setIfMissing, unset, useFormValue, type ArrayOfObjectsInputProps, type Path } from "sanity";
import { Badge, Box, Button, Card, Flex, Stack, Text, TextArea, TextInput } from "@sanity/ui";
// @sanity/icons 5 exposes each icon on its own subpath; the bare index has no named icons.
import { ChevronDownIcon } from "@sanity/icons/ChevronDown";
import { ChevronRightIcon } from "@sanity/icons/ChevronRight";
import { ResetIcon } from "@sanity/icons/Reset";
import { SearchIcon } from "@sanity/icons/Search";
import { PUBLIC_COPY_SCOPES, type PublicCopyScope } from "../../../lib/content/public-copy-registry";
import locations from "../../../lib/content/public-copy-locations.json";

type Entry = { _key: string; _type?: string; key: string; text?: string; size?: string; sizeMobile?: number; sizeDesktop?: number };
type Location = { section: string; kind: string; visible: boolean; order: number };
type ScopeLocations = { sections: string[]; entries: Record<string, Location> };
const LOCATIONS = locations as Record<string, ScopeLocations>;

const entryKey = (key: string) => key.replaceAll(".", "-");
const placeholders = (value: string) => Array.from(new Set(value.match(/\{[a-zA-Z0-9_]+\}/g) ?? []));

/**
 * Page-ordered editor for one page's texts. Editors see where each text sits on
 * the page (section, element) instead of storage keys, can search, reset to the
 * approved original. Page copy is text-only: font size is edited per article
 * body (Portable Text marks), not here. Reset still clears any legacy size.
 */
export default function PublicCopyEntriesInput(props: ArrayOfObjectsInputProps) {
  const { onChange, readOnly } = props;
  const scope = useFormValue(["scope"]) as PublicCopyScope | undefined;
  const value = useMemo(() => (props.value ?? []) as Entry[], [props.value]);
  const [query, setQuery] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const config = scope && Object.hasOwn(PUBLIC_COPY_SCOPES, scope) ? PUBLIC_COPY_SCOPES[scope] : null;
  const defaults = useMemo(() => (config?.defaults ?? {}) as Record<string, string>, [config]);
  const scopeLocations = scope ? LOCATIONS[scope] : undefined;
  const byKey = useMemo(() => new Map(value.map(entry => [entry.key, entry])), [value]);

  const sections = useMemo(() => {
    if (!scopeLocations) return [];
    const grouped = new Map<string, Array<{ key: string; location: Location }>>(scopeLocations.sections.map(section => [section, []]));
    for (const [key, location] of Object.entries(scopeLocations.entries)) {
      if (!Object.hasOwn(defaults, key)) continue;
      // Keep persisted trial/return copy valid, but never offer retired About text as current-page edits.
      if (scope === "about" && ((key.startsWith("about.father.") && key !== "about.father.photoAlt") || key === "about.storyV2.verify.back")) continue;
      grouped.get(location.section)?.push({ key, location });
    }
    return [...grouped.entries()].map(([section, items]) => ({ section, items: items.sort((a, b) => a.location.order - b.location.order) })).filter(group => group.items.length);
  }, [scopeLocations, defaults, scope]);

  // A click on the page in "ตัวอย่างเว็บไซต์" focuses entries[_key==…].text:
  // open that text's section and bring its row into view.
  const focusKey = (props.focusPath?.[0] as { _key?: string } | undefined)?._key;
  const focusCopyKey = focusKey && scopeLocations ? value.find(entry => entry._key === focusKey)?.key ?? Object.keys(scopeLocations.entries).find(candidate => entryKey(candidate) === focusKey) : undefined;
  const focusSection = focusCopyKey ? scopeLocations?.entries[focusCopyKey]?.section : undefined;
  useEffect(() => {
    if (!focusCopyKey || !focusKey) return;
    const resetFilters = setTimeout(() => { setQuery(""); setOnlyChanged(false); }, 0);
    const timer = setTimeout(() => {
      const row = document.getElementById(`copy-${entryKey(focusCopyKey)}`);
      row?.scrollIntoView({ behavior: "auto", block: "center" });
      row?.querySelector("textarea")?.focus({ preventScroll: true });
    }, 60);
    return () => { clearTimeout(resetFilters); clearTimeout(timer); };
  }, [focusCopyKey, focusKey, scope]);

  if (!config || !scopeLocations) return props.renderDefault(props);

  const needle = query.trim().toLowerCase();
  const isChanged = (key: string) => {
    const entry = byKey.get(key);
    return Boolean(entry && ((entry.text ?? defaults[key]) !== defaults[key] || entry.size || entry.sizeMobile || entry.sizeDesktop));
  };
  const matches = (key: string) => {
    if (onlyChanged && !isChanged(key)) return false;
    if (!needle) return true;
    const text = byKey.get(key)?.text ?? defaults[key];
    return text.toLowerCase().includes(needle) || defaults[key].toLowerCase().includes(needle) || key.toLowerCase().includes(needle);
  };
  const filtering = Boolean(needle) || onlyChanged;
  const changedCount = sections.flatMap(({ items }) => items).filter(({ key }) => isChanged(key)).length;

  // Every write targets the entry by _key; an entry missing from an older
  // document is created from the approved default first.
  const patchEntry = (key: string, field: keyof Entry, next: string | number | undefined) => {
    if (readOnly) return;
    const path: Path = [{ _key: byKey.get(key)?._key ?? entryKey(key) }, field];
    const patches = [];
    if (!byKey.has(key)) {
      patches.push(setIfMissing([]), insert([{ _type: "publicCopyEntry", _key: entryKey(key), key, text: defaults[key] }], "after", [-1]));
    }
    patches.push(next === undefined ? unset(path) : set(next, path));
    onChange(patches);
  };
  const resetEntry = (key: string) => {
    const entry = byKey.get(key);
    if (readOnly || !entry) return;
    onChange([set(defaults[key], [{ _key: entry._key }, "text"]), unset([{ _key: entry._key }, "size"]), unset([{ _key: entry._key }, "sizeMobile"]), unset([{ _key: entry._key }, "sizeDesktop"])]);
  };

  return (
    <Stack gap={4}>
      <Card padding={3} radius={2} tone="primary" border>
        <Stack gap={3}>
          <Text size={1}>ข้อความเรียงตามลำดับที่คนเห็นบนหน้า กดชื่อส่วนเพื่อเปิด หรือคลิกข้อความในแท็บ “ตัวอย่างเว็บไซต์” เพื่อมาที่ช่องนั้นโดยตรง</Text>
          <Flex gap={2} wrap="wrap" align="center">
            <Box flex={1} style={{ minWidth: 220 }}>
              <TextInput aria-label="ค้นหาข้อความบนหน้า" icon={SearchIcon} placeholder="ค้นหาข้อความบนหน้า" value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.currentTarget.value)} clearButton={Boolean(query)} onClear={() => setQuery("")} />
            </Box>
            <Button mode={onlyChanged ? "default" : "ghost"} tone={onlyChanged ? "primary" : "default"} aria-pressed={onlyChanged} text={`ต่างจากค่าเริ่มต้น ${changedCount}`} onClick={() => setOnlyChanged(!onlyChanged)} />
          </Flex>
        </Stack>
      </Card>

      {filtering && !sections.some(({ items }) => items.some(({ key }) => matches(key))) ? <Text size={1} role="status">ไม่พบข้อความที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหรือปิดตัวกรอง “ต่างจากค่าเริ่มต้น”</Text> : null}
      {sections.map(({ section, items }) => {
        const visible = items.filter(item => matches(item.key));
        if (filtering && !visible.length) return null;
        const expanded = Boolean(filtering || open[section] || section === focusSection);
        const sectionId = `copy-section-${scope}-${scopeLocations.sections.indexOf(section)}`;
        const sectionChanged = items.filter(item => isChanged(item.key)).length;
        return (
          <Card key={section} radius={2} border>
            <Button mode="bleed" width="fill" justify="flex-start" padding={3} icon={expanded ? ChevronDownIcon : ChevronRightIcon}
              aria-expanded={expanded} aria-controls={expanded ? sectionId : undefined}
              text={`${section} · ${filtering ? visible.length : items.length} ข้อความ${sectionChanged ? ` · ต่างจากค่าเริ่มต้น ${sectionChanged}` : ""}`}
              onClick={() => setOpen({ ...open, [section]: !open[section] })} />
            {expanded ? (
              <Stack gap={3} padding={3} id={sectionId}>
                {visible.map(({ key, location }) => (
                  <CopyRow key={key} copyKey={key} location={location} entry={byKey.get(key)} original={defaults[key]} readOnly={Boolean(readOnly)} changed={isChanged(key)}
                    onText={text => patchEntry(key, "text", text)} onReset={() => resetEntry(key)} />
                ))}
              </Stack>
            ) : null}
          </Card>
        );
      })}
    </Stack>
  );
}

function CopyRow({ copyKey, location, entry, original, readOnly, changed, onText, onReset }: {
  copyKey: string; location: Location; entry: Entry | undefined; original: string; readOnly: boolean; changed: boolean;
  onText: (text: string) => void; onReset: () => void;
}) {
  const text = entry?.text ?? original;
  const missing = placeholders(original).filter(token => !text.includes(token));
  const unknown = placeholders(text).filter(token => !placeholders(original).includes(token));
  const invalidText = text.length > 12000 || /[<\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\uE000]/.test(text);
  const invalid = !text.trim() || invalidText || missing.length > 0 || unknown.length > 0;
  const inputId = `copy-input-${entryKey(copyKey)}`;
  return (
    <Card padding={3} radius={2} tone={changed ? "caution" : "default"} border id={`copy-${entryKey(copyKey)}`}>
      <Stack gap={3}>
        <Flex gap={2} align="center" wrap="wrap">
          <Text size={1} weight="semibold"><label htmlFor={inputId}>{location.kind}</label></Text>
          {!location.visible ? <Badge tone="default">ไม่แสดงบนจอ · ใช้กับโปรแกรมอ่านหน้าจอ</Badge> : null}
          {changed ? <Badge tone="caution">ต่างจากค่าเริ่มต้น</Badge> : null}
          <Box flex={1} />
          <details><summary>รหัสอ้างอิงข้อความ</summary><Text size={0} muted>{copyKey}</Text></details>
        </Flex>
        <TextArea id={inputId} aria-label={`${location.section} · ${location.kind}`} aria-invalid={invalid} aria-describedby={invalid ? `${inputId}-error` : undefined} rows={Math.min(8, Math.max(1, Math.ceil(text.length / 70)))} value={text} readOnly={readOnly}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onText(event.currentTarget.value)} />
        {invalid ? <Text id={`${inputId}-error`} role="alert" size={1} style={{ color: "var(--card-badge-critical-dot-color, #f03e2f)" }}>{!text.trim() ? "กรุณาใส่ข้อความก่อนเผยแพร่ หรือกดคืนค่าเริ่มต้น" : invalidText ? "ใช้ข้อความธรรมดาไม่เกิน 12,000 ตัวอักษร โดยไม่ใส่ HTML หรืออักขระควบคุม" : missing.length ? `ต้องคง ${missing.join(" ")} ไว้ ระบบใช้เติมตัวเลขหรือชื่อ` : `ไม่รู้จัก ${unknown.join(" ")} กรุณาลบคำในวงเล็บปีกกาที่เพิ่มมา`}</Text> : null}
        {text !== original ? <Text size={1} muted>ข้อความค่าเริ่มต้น: {original}</Text> : null}
        {changed ? (
          <Flex justify="flex-end">
            <Button mode="ghost" tone="critical" fontSize={1} padding={2} icon={ResetIcon} text="คืนค่าเริ่มต้น" disabled={readOnly} onClick={onReset} />
          </Flex>
        ) : null}
      </Stack>
    </Card>
  );
}
