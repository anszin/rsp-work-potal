import { useState, useEffect, useRef, useCallback } from 'react'

export type SystemFilter = number | 'ALL'

type Screen = 'cr' | 'dr' // 변경 관리 / 배포 관리 — 저장 키는 화면별 독립

const storageKey = (screen: Screen, username: string) => `systemFilter:${screen}:${username}`

// 저장값 읽기. 없거나 깨졌거나 저장소 접근 불가면 null
function readStored(key: string): SystemFilter | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    if (raw === 'ALL') return 'ALL'
    const n = Number(raw)
    return Number.isInteger(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

interface Options {
  screen: Screen
  username?: string       // 로그인 사용자. 없으면 초기값 결정·저장을 하지 않는다
  activeIds: number[]     // 활성 운영시스템 ID
  managedIds: number[]    // 로그인 사용자의 담당 시스템 ID (GET /systems/managed)
  loaded: boolean         // 활성·담당 목록 로드 완료 — 이때 한 번만 초기값을 정한다
}

/**
 * 운영시스템 필터 상태 — 사용자·화면별 초기값과 기억 (REQ-2026-004, F-CR-004·F-DR-006 R-001 1.1)
 *
 * 초기값: ① 이 사용자·이 화면의 저장값('ALL' 포함, 시스템이면 활성 검증) → ② 담당 시스템 ∩ 활성 이 정확히 1개면 그것 → ③ 'ALL'
 * 결정은 목록이 로드된 뒤 한 번만. 그 전에 사용자가 바꿨으면 적용하지 않는다.
 * 기억: 사용자가 바꿀 때마다 localStorage 에 저장. 저장 불가 환경은 무시. 로그아웃 시 지우지 않는다(사용자별 키).
 */
export function useSystemFilter({ screen, username, activeIds, managedIds, loaded }: Options) {
  const [value, setValue] = useState<SystemFilter>('ALL')
  const touched = useRef(false)  // 사용자가 손으로 바꿨는지
  const decided = useRef(false)  // 초기값을 이미 정했는지

  useEffect(() => {
    if (decided.current || touched.current || !loaded || !username) return
    decided.current = true
    const stored = readStored(storageKey(screen, username))
    if (stored === 'ALL' || (stored !== null && activeIds.includes(stored))) {
      setValue(stored)
      return
    }
    const managedActive = managedIds.filter(id => activeIds.includes(id))
    setValue(managedActive.length === 1 ? managedActive[0] : 'ALL')
  }, [screen, username, activeIds, managedIds, loaded])

  const change = useCallback((next: SystemFilter) => {
    touched.current = true
    setValue(next)
    if (!username) return
    try {
      localStorage.setItem(storageKey(screen, username), String(next))
    } catch {
      // 사생활 보호 모드 등 저장 불가 — 세션 안에서만 유지
    }
  }, [screen, username])

  return [value, change] as const
}
