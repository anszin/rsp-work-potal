package com.platform.portal.api;

import com.platform.portal.domain.system.dto.SystemDto;
import com.platform.portal.domain.system.service.OperationSystemService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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

    @GetMapping("/{id}")
    public ResponseEntity<SystemDto.Response> get(@PathVariable Long id) {
        return ResponseEntity.ok(systemService.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SystemDto.Response> create(@Valid @RequestBody SystemDto.CreateRequest req) {
        return ResponseEntity.ok(systemService.create(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SystemDto.Response> update(@PathVariable Long id,
                                                      @Valid @RequestBody SystemDto.UpdateRequest req) {
        return ResponseEntity.ok(systemService.update(id, req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        systemService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
