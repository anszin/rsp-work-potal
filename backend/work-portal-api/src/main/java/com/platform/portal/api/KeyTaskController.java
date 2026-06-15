package com.platform.portal.api;

import com.platform.portal.domain.keytask.dto.KeyTaskDto;
import com.platform.portal.domain.keytask.service.KeyTaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/key-tasks")
@RequiredArgsConstructor
public class KeyTaskController {

    private final KeyTaskService service;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public List<KeyTaskDto.Response> list(@RequestParam Integer year) {
        return service.findByYear(year);
    }

    @GetMapping("/years")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public List<Integer> years() {
        return service.getYears();
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public KeyTaskDto.Response create(@Valid @RequestBody KeyTaskDto.SaveRequest req) {
        return service.create(req);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public KeyTaskDto.Response update(@PathVariable Long id, @Valid @RequestBody KeyTaskDto.SaveRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
