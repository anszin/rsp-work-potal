package com.platform.portal.api;

import com.platform.portal.domain.deploy.dto.DeployRequestDto;
import com.platform.portal.domain.deploy.dto.DeployStepDto;
import com.platform.portal.domain.deploy.service.DeployRequestService;
import com.platform.portal.domain.deploy.service.DeployStepService;
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
    private final DeployStepService stepService;

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
            @Valid @RequestBody DeployRequestDto.UpdateRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(service.update(id, req, user.getUsername()));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<DeployRequestDto.Response> changeStatus(
            @PathVariable Long id,
            @Valid @RequestBody DeployRequestDto.StatusRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(service.changeStatus(id, req, user.getUsername()));
    }

    @PostMapping("/{id}/sync-redmine")
    public ResponseEntity<DeployRequestDto.Response> syncRedmine(@PathVariable Long id) {
        return ResponseEntity.ok(service.syncRedmine(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                       @AuthenticationPrincipal UserDetails user) {
        service.delete(id, user.getUsername());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/steps")
    public ResponseEntity<List<DeployStepDto.Response>> getSteps(@PathVariable Long id) {
        return ResponseEntity.ok(stepService.findByDeployRequestId(id));
    }

    @PostMapping("/steps/{stepId}/complete")
    public ResponseEntity<DeployStepDto.CompleteResult> completeStep(
            @PathVariable Long stepId,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(stepService.complete(stepId, user.getUsername()));
    }
}
