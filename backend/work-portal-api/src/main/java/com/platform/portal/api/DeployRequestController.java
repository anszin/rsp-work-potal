package com.platform.portal.api;

import com.platform.portal.domain.deploy.dto.DeployRequestDto;
import com.platform.portal.domain.deploy.service.DeployRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/deploy-requests")
@RequiredArgsConstructor
public class DeployRequestController {

    private final DeployRequestService service;

    @GetMapping
    public ResponseEntity<List<DeployRequestDto.Response>> list(
            @RequestParam(required = false) Long systemId) {
        if (systemId != null) return ResponseEntity.ok(service.findBySystemId(systemId));
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<DeployRequestDto.Response> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    public ResponseEntity<DeployRequestDto.Response> create(
            @Valid @RequestBody DeployRequestDto.CreateRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(service.create(req, user.getUsername()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<DeployRequestDto.Response> update(
            @PathVariable Long id,
            @Valid @RequestBody DeployRequestDto.UpdateRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<DeployRequestDto.Response> changeStatus(
            @PathVariable Long id,
            @Valid @RequestBody DeployRequestDto.StatusRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(service.changeStatus(id, req.getStatus(), user.getUsername()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
