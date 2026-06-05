package com.platform.portal.domain.menu.service;

import com.platform.portal.domain.menu.entity.MenuPermission;
import com.platform.portal.domain.menu.repository.MenuPermissionRepository;
import com.platform.portal.domain.user.entity.User;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MenuPermissionService {

    private final MenuPermissionRepository repo;

    // menuKey → 역할별 기본값 (true=허용)
    private static final List<Object[]> DEFAULTS = List.of(
        new Object[]{"change_requests", Map.of(User.Role.ADMIN, true, User.Role.MANAGER, true, User.Role.MEMBER, true,  User.Role.EXTERNAL, true)},
        new Object[]{"deploys",         Map.of(User.Role.ADMIN, true, User.Role.MANAGER, true, User.Role.MEMBER, true,  User.Role.EXTERNAL, false)},
        new Object[]{"inventory",       Map.of(User.Role.ADMIN, true, User.Role.MANAGER, true, User.Role.MEMBER, true,  User.Role.EXTERNAL, false)},
        new Object[]{"meeting_minutes", Map.of(User.Role.ADMIN, true, User.Role.MANAGER, true, User.Role.MEMBER, true,  User.Role.EXTERNAL, false)},
        new Object[]{"weekly_report",   Map.of(User.Role.ADMIN, true, User.Role.MANAGER, true, User.Role.MEMBER, true,  User.Role.EXTERNAL, false)},
        new Object[]{"daily_check",     Map.of(User.Role.ADMIN, true, User.Role.MANAGER, true, User.Role.MEMBER, true,  User.Role.EXTERNAL, false)},
        new Object[]{"finance",         Map.of(User.Role.ADMIN, true, User.Role.MANAGER, true, User.Role.MEMBER, true,  User.Role.EXTERNAL, false)},
        new Object[]{"system_mgmt",     Map.of(User.Role.ADMIN, true, User.Role.MANAGER, true, User.Role.MEMBER, false, User.Role.EXTERNAL, false)},
        new Object[]{"user_mgmt",       Map.of(User.Role.ADMIN, true, User.Role.MANAGER, true, User.Role.MEMBER, false, User.Role.EXTERNAL, false)}
    );

    @PostConstruct
    @Transactional
    public void seedDefaults() {
        for (Object[] row : DEFAULTS) {
            String menuKey = (String) row[0];
            @SuppressWarnings("unchecked")
            Map<User.Role, Boolean> roleMap = (Map<User.Role, Boolean>) row[1];
            for (Map.Entry<User.Role, Boolean> entry : roleMap.entrySet()) {
                if (repo.findByRoleAndMenuKey(entry.getKey(), menuKey).isEmpty()) {
                    repo.save(new MenuPermission(entry.getKey(), menuKey, entry.getValue()));
                }
            }
        }
    }

    @Transactional(readOnly = true)
    public List<MenuPermission> findAll() {
        return repo.findAll();
    }

    @Transactional
    public void update(User.Role role, String menuKey, boolean enabled) {
        MenuPermission mp = repo.findByRoleAndMenuKey(role, menuKey)
                .orElseGet(() -> new MenuPermission(role, menuKey, enabled));
        mp.setEnabled(enabled);
        repo.save(mp);
    }
}
