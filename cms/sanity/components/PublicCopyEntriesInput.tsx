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
      grouped.get(location.section)?.push({ key, location });
    }
    return [...grouped.entries()].map(([section, items]) => ({ section, items: items.sort((a, b) => a.location.order - b.location.order) })).filter(group => group.items.length);
  }, [scopeLocations, defaults]);

  // A click on the page in "ตัวอย่างเว็บไซต์" focuses entries[_key==…].text:
  // open that text's section and bring its row into view.
  const focusKey = (props.focusPath?.[0] as { _key?: string } | undefined)?._key;
  const focusCopyKey = focusKey && scopeLocations ? Object.keys(scopeLocations.entries).find(candidate => entryKey(candidate) === focusKey) : undefined;
  const focusSection = focusCopyKey ? scopeLocations?.entries[focusCopyKey]?.section : undefined;
  useEffect(() => {
    if (!focusCopyKey || !focusKey) return;
    const timer = setTimeout(() => {
      const row = document.getElementById(`copy-${focusKey}`);
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      row?.querySelector("textarea")?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [focusCopyKey, focusKey]);

  if (!config || !scopeLocations) return props.renderDefault(props);

  const needle = query.trim().toLowerCase();
  const isChanged = (key: string) => {
    const entry = byKey.get(key);
    return Boolean(entry && ((entry.text ?? defaults[key]) !== defaults[key] || entry.size || entry.sizeMobile || entry.sizeDesktop));
  };
  const matches = (key: string) => {
    if (key === focusCopyKey) return true;
    if (onlyChanged && !isChanged(key)) return false;
    if (!needle) return true;
    const text = byKey.get(key)?.text ?? defaults[key];
    return text.toLowerCase().includes(needle) || defaults[key].toLowerCase().includes(needle) || key.toLowerCase().includes(needle);
  };
  const filtering = Boolean(needle) || onlyChanged;
  const changedCount = Object.keys(defaults).filter(isChanged).length;

  // Every write targets the entry by _key; an entry missing from an older
  // document is created from the approved default first.
  const patchEntry = (key: string, field: keyof Entry, next: string | number | undefined) => {
    const path: Path = [{ _key: entryKey(key) }, field];
    const patches = [];
    if (!byKey.has(key)) {
      patches.push(setIfMissing([]), insert([{ _type: "publicCopyEntry", _key: entryKey(key), key, text: defaults[key] }], "after", [-1]));
    }
    patches.push(next === undefined || next === "" ? unset(path) : set(next, path));
    onChange(patches);
  };
  const resetEntry = (key: string) => {
    if (!byKey.has(key)) return;
    onChange([set(defaults[key], [{ _key: entryKey(key) }, "text"]), unset([{ _key: entryKey(key) }, "size"]), unset([{ _key: entryKey(key) }, "sizeMobile"]), unset([{ _key: entryKey(key) }, "sizeDesktop"])]);
  };

  return (
    <Stack gap={4}>
      <Card padding={3} radius={2} tone="primary" border>
        <Stack gap={3}>
          <Text size={1}>ข้อความเรียงตามลำดับที่คนเห็นบนหน้า กดชื่อส่วนเพื่อเปิด หรือคลิกข้อความในแท็บ “ตัวอย่างเว็บไซต์” เพื่อมาที่ช่องนั้นโดยตรง</Text>
          <Flex gap={2} wrap="wrap" align="center">
            <Box flex={1} style={{ minWidth: 220 }}>
              <TextInput icon={SearchIcon} placeholder="ค้นหาข้อความบนหน้า" value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.currentTarget.value)} clearButton={Boolean(query)} onClear={() => setQuery("")} />
            </Box>
            <Button mode={onlyChanged ? "default" : "ghost"} tone={onlyChanged ? "primary" : "default"} text={`แก้แล้ว ${changedCount}`} onClick={() => setOnlyChanged(!onlyChanged)} />
          </Flex>
        </Stack>
      </Card>

      {sections.map(({ section, items }) => {
        const visible = items.filter(item => matches(item.key));
        if (filtering && !visible.length) return null;
        const expanded = filtering || open[section] || section === focusSection;
        const sectionChanged = items.filter(item => isChanged(item.key)).length;
        return (
          <Card key={section} radius={2} border>
            <Button mode="bleed" width="fill" justify="flex-start" padding={3} icon={expanded ? ChevronDownIcon : ChevronRightIcon}
              text={`${section} · ${filtering ? visible.length : items.length} ข้อความ${sectionChanged ? ` · แก้แล้ว ${sectionChanged}` : ""}`}
              onClick={() => setOpen({ ...open, [section]: !open[section] })} />
            {expanded ? (
              <Stack gap={3} padding={3}>
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
  return (
    <Card padding={3} radius={2} tone={changed ? "caution" : "default"} border id={`copy-${entryKey(copyKey)}`}>
      <Stack gap={3}>
        <Flex gap={2} align="center" wrap="wrap">
          <Text size={1} weight="semibold">{location.kind}</Text>
          {!location.visible ? <Badge tone="default">ไม่แสดงบนจอ · ใช้กับโปรแกรมอ่านหน้าจอ</Badge> : null}
          {changed ? <Badge tone="caution">แก้แล้ว</Badge> : null}
          <Box flex={1} />
          <Text size={0} muted title="รหัสข้อความในระบบ">{copyKey}</Text>
        </Flex>
        <TextArea rows={Math.min(8, Math.max(1, Math.ceil(text.length / 70)))} value={text} readOnly={readOnly}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onText(event.currentTarget.value)} />
        {missing.length ? <Text size={1} style={{ color: "var(--card-badge-critical-dot-color, #f03e2f)" }}>ต้องคง {missing.join(" ")} ไว้ ระบบใช้เติมตัวเลขหรือชื่อ</Text> : null}
        {text !== original ? <Text size={1} muted>ข้อความเดิม: {original}</Text> : null}
        {changed ? (
          <Flex justify="flex-end">
            <Button mode="ghost" tone="critical" fontSize={1} padding={2} icon={ResetIcon} text="คืนค่าเดิม" disabled={readOnly} onClick={onReset} />
          </Flex>
        ) : null}
      </Stack>
    </Card>
  );
}
