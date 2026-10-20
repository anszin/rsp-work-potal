package com.platform.portal.domain.user.service;

import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/**
 * username(정식 식별자, 불변) 기준 사용자 조회 공통 — F-AUTH-001.
 * - 이름 매핑: 보고류·To-Do 응답에 username → 이름 (L1 ② A+)
 * - 역할 판정: 소유자 검사의 "또는 ADMIN/MANAGER" (L1 ①)
 */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserLookup {

    private final UserRepository userRepository;

    /** username 집합 → 이름. 없는 사용자(삭제됨)는 키 자체가 없음 → get() 이 null */
    public Map<String, String> namesOf(Collection<String> usernames) {
        Map<String, String> names = new HashMap<>();
        if (usernames == null || usernames.isEmpty()) return names;
        var distinct = usernames.stream().filter(Objects::nonNull).distinct().toList();
        userRepository.findByUsernameIn(distinct).forEach(u -> names.put(u.getUsername(), u.getName()));
        return names;
    }

    public String nameOf(String username) {
        if (username == null) return null;
        return userRepository.findByUsername(username).map(User::getName).orElse(null);
    }

    public boolean isAdminOrManager(String username) {
        return userRepository.findByUsername(username)
                .map(u -> u.getRole() == User.Role.ADMIN || u.getRole() == User.Role.MANAGER)
                .orElse(false);
    }
}
