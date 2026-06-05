package com.platform.portal.api;

import com.platform.portal.domain.menu.entity.MenuPermission;
import com.platform.portal.domain.menu.service.MenuPermissionService;
import com.platform.portal.domain.user.entity.User;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/menu-permissions")
@RequiredArgsConstructor
public class MenuPermissionController {

    private final MenuPermissionService service;

    @GetMapping
    public ResponseEntity<List<PermissionDto>> list() {
        List<PermissionDto> result = service.findAll().stream()
                .map(mp -> new PermissionDto(mp.getRole().name(), mp.getMenuKey(), mp.isEnabled()))
                .toList();
        return ResponseEntity.ok(result);
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> update(@RequestBody List<UpdateRequest> requests) {
        for (UpdateRequest req : requests) {
            service.update(User.Role.valueOf(req.getRole()), req.getMenuKey(), req.isEnabled());
        }
        return ResponseEntity.noContent().build();
    }

    @Getter
    public static class PermissionDto {
        private final String role;
        private final String menuKey;
        private final boolean enabled;
        public PermissionDto(String role, String menuKey, boolean enabled) {
            this.role = role; this.menuKey = menuKey; this.enabled = enabled;
        }
    }

    @Getter @Setter
    public static class UpdateRequest {
        @NotNull private String role;
        @NotBlank private String menuKey;
        private boolean enabled;
    }
}
