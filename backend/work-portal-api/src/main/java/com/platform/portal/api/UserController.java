package com.platform.portal.api;

import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<UserSummary>> list() {
        List<UserSummary> users = userRepository.findAll().stream()
                .map(UserSummary::new).toList();
        return ResponseEntity.ok(users);
    }

    @Getter
    public static class UserSummary {
        private final Long id;
        private final String username;
        private final String role;

        public UserSummary(User u) {
            this.id = u.getId();
            this.username = u.getUsername();
            this.role = u.getRole().name();
        }
    }
}
