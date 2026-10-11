"use client";
import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { safeBlogReturn } from './BlogNavigation';
const subscribe = () => () => {};
const readContext = () => { try { return safeBlogReturn(sessionStorage.getItem('ccpun:blog-return')); } catch { return null; } };
export default function BlogReturnLink() {
  const href = useSyncExternalStore(subscribe, readContext, () => null);
  return href ? <p><Link href={href}>← กลับไปผลการค้นหาและรายการเดิม</Link></p> : null;
}
