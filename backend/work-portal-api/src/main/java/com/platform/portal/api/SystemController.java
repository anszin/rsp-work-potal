package com.platform.portal.api;

import com.platform.portal.domain.system.dto.SystemDto;
import com.platform.portal.domain.system.service.OperationSystemService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/systems")
@RequiredArgsConstructor
public class SystemController {

    private final OperationSystemService systemService;

    @GetMapping
    public ResponseEntity<List<SystemDto.Response>> list() {
        return ResponseEntity.ok(systemService.findAll());
    }

    @GetMapping("/active")
    public ResponseEntity<List<SystemDto.Response>> listActive() {
        return ResponseEntity.ok(systemService.findActive());
    }

    @GetMapping("/managed")
    public ResponseEntity<List<Long>> managedSystemIds(@AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(systemService.findManagedSystemIds(user.getUsername()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SystemDto.Response> get(@PathVariable Long id) {
        return ResponseEntity.ok(systemService.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<SystemDto.Response> create(@Valid @RequestBody SystemDto.CreateRequest req) {
        return ResponseEntity.ok(systemService.create(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<SystemDto.Response> update(@PathVariable Long id,
                                                      @Valid @RequestBody SystemDto.UpdateRequest req) {
        return ResponseEntity.ok(systemService.update(id, req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        systemService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/managers")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<SystemDto.ManagerResponse>> listManagers(@PathVariable Long id) {
        return ResponseEntity.ok(systemService.findManagers(id));
    }

    @PostMapping("/{id}/managers")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<SystemDto.ManagerResponse> addManager(
            @PathVariable Long id,
            @Valid @RequestBody SystemDto.AddManagerRequest req) {
        return ResponseEntity.ok(systemService.addManager(id, req.getUserId()));
    }

    @DeleteMapping("/{id}/managers/{userId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> removeManager(@PathVariable Long id, @PathVariable Long userId) {
        systemService.removeManager(id, userId);
        return ResponseEntity.noContent().build();
    }
}
