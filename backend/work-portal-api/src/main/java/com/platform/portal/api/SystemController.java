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

    @GetMapping("/{id}/subsystems")
    public ResponseEntity<List<SystemDto.SubSystemResponse>> listSubSystems(@PathVariable Long id) {
        return ResponseEntity.ok(systemService.findSubSystems(id));
    }

    @GetMapping("/{id}/subsystems/active")
    public ResponseEntity<List<SystemDto.SubSystemResponse>> listActiveSubSystems(@PathVariable Long id) {
        return ResponseEntity.ok(systemService.findActiveSubSystems(id));
    }

    @PostMapping("/{id}/subsystems")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<SystemDto.SubSystemResponse> createSubSystem(
            @PathVariable Long id,
            @Valid @RequestBody SystemDto.SubSystemCreateRequest req) {
        return ResponseEntity.ok(systemService.createSubSystem(id, req));
    }

    @PutMapping("/{id}/subsystems/{subId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<SystemDto.SubSystemResponse> updateSubSystem(
            @PathVariable Long id,
            @PathVariable Long subId,
            @Valid @RequestBody SystemDto.SubSystemUpdateRequest req) {
        return ResponseEntity.ok(systemService.updateSubSystem(id, subId, req));
    }

    @DeleteMapping("/{id}/subsystems/{subId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> deleteSubSystem(@PathVariable Long id, @PathVariable Long subId) {
        systemService.deleteSubSystem(id, subId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/servers")
    public ResponseEntity<List<SystemDto.ServerResponse>> listServers(@PathVariable Long id) {
        return ResponseEntity.ok(systemService.findServers(id));
    }

    @PostMapping("/{id}/servers")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<SystemDto.ServerResponse> addServer(
            @PathVariable Long id,
            @Valid @RequestBody SystemDto.ServerRequest req) {
        return ResponseEntity.ok(systemService.addServer(id, req));
    }

    @DeleteMapping("/{id}/servers/{serverId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> deleteServer(@PathVariable Long id, @PathVariable Long serverId) {
        systemService.deleteServer(id, serverId);
        return ResponseEntity.noContent().build();
    }
}
