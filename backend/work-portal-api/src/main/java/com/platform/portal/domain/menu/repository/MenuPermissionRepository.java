package com.platform.portal.domain.menu.repository;

import com.platform.portal.domain.menu.entity.MenuPermission;
import com.platform.portal.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MenuPermissionRepository extends JpaRepository<MenuPermission, Long> {
    List<MenuPermission> findAll();
    Optional<MenuPermission> findByRoleAndMenuKey(User.Role role, String menuKey);
}
