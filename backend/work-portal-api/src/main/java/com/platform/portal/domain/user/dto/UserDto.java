package com.platform.portal.domain.user.dto;

import com.platform.portal.domain.user.entity.User;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

public class UserDto {

    @Getter @Setter
    public static class CreateRequest {
        @NotBlank
        private String username;
        private String name;
        private String dept;
        private String email;
        @NotNull
        private User.Role role;
    }

    @Getter @Setter
    public static class UpdateRequest {
        private String name;
        private String dept;
        private String email;
        private User.Role role;
        private boolean active = true;
        private Integer redmineUserId;
    }

    @Getter @Setter
    public static class ChangePasswordRequest {
        @NotBlank
        private String currentPassword;
        @NotBlank
        private String newPassword;
    }

    @Getter
    public static class Summary {
        private final Long id;
        private final String username;
        private final String name;
        private final String dept;
        private final String email;
        private final String role;
        private final boolean active;
        private final boolean mustChangePassword;
        private final String tempPassword; // 최초 생성 시에만 포함, 이후 null
        private final Integer redmineUserId;
        private final LocalDateTime createdAt;

        public Summary(User u, String tempPassword) {
            this.id = u.getId();
            this.username = u.getUsername();
            this.name = u.getName();
            this.dept = u.getDept();
            this.email = u.getEmail();
            this.role = u.getRole().name();
            this.active = u.isActive();
            this.mustChangePassword = Boolean.TRUE.equals(u.getMustChangePassword());
            this.tempPassword = tempPassword;
            this.redmineUserId = u.getRedmineUserId();
            this.createdAt = u.getCreatedAt();
        }
    }
}
