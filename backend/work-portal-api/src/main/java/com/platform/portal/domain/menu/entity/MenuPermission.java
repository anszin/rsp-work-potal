package com.platform.portal.domain.menu.entity;

import com.platform.portal.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "menu_permissions", uniqueConstraints = @UniqueConstraint(columnNames = {"role", "menu_key"}))
@Getter
@Setter
@NoArgsConstructor
public class MenuPermission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private User.Role role;

    @Column(name = "menu_key", nullable = false)
    private String menuKey;

    @Column(nullable = false)
    private boolean enabled;

    public MenuPermission(User.Role role, String menuKey, boolean enabled) {
        this.role = role;
        this.menuKey = menuKey;
        this.enabled = enabled;
    }
}
