package com.platform.portal.api;

import com.platform.portal.domain.user.dto.UserDto;
import com.platform.portal.domain.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'MEMBER')")
    public ResponseEntity<List<UserDto.Summary>> list() {
        return ResponseEntity.ok(userService.findAll());
    }

    @PostMapping
    public ResponseEntity<UserDto.Summary> create(
            @Valid @RequestBody UserDto.CreateRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(userService.create(req, user.getUsername()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<UserDto.Summary> update(
            @PathVariable Long id,
            @RequestBody UserDto.UpdateRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(userService.update(id, req, user.getUsername()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails user) {
        userService.delete(id, user.getUsername());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reset-password")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<UserDto.Summary> resetPassword(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(userService.resetPassword(id, user.getUsername()));
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(
            @Valid @RequestBody UserDto.ChangePasswordRequest req,
            @AuthenticationPrincipal UserDetails user) {
        userService.changePassword(user.getUsername(), req.getCurrentPassword(), req.getNewPassword());
        return ResponseEntity.noContent().build();
    }
}
