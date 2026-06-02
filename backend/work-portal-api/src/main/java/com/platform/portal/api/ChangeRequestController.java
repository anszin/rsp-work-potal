package com.platform.portal.api;

import com.platform.portal.domain.request.dto.ChangeRequestDto;
import com.platform.portal.domain.request.entity.ChangeRequest;
import com.platform.portal.domain.request.service.ChangeRequestService;
import com.platform.portal.service.FileStorageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.MalformedURLException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/change-requests")
@RequiredArgsConstructor
public class ChangeRequestController {

    private final ChangeRequestService service;
    private final FileStorageService fileStorageService;

    @GetMapping
    public ResponseEntity<List<ChangeRequestDto.Response>> list(
            @RequestParam(required = false) Long systemId,
            @RequestParam(required = false) ChangeRequest.Status status) {
        if (systemId != null) return ResponseEntity.ok(service.findBySystemId(systemId));
        if (status != null) return ResponseEntity.ok(service.findByStatus(status));
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ChangeRequestDto.Response> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    public ResponseEntity<ChangeRequestDto.Response> create(
            @Valid @RequestBody ChangeRequestDto.CreateRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(service.create(req, user.getUsername()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ChangeRequestDto.Response> update(
            @PathVariable Long id,
            @Valid @RequestBody ChangeRequestDto.UpdateRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ChangeRequestDto.Response> changeStatus(
            @PathVariable Long id,
            @Valid @RequestBody ChangeRequestDto.StatusRequest req) {
        return ResponseEntity.ok(service.changeStatus(id, req.getStatus()));
    }

    @PostMapping("/{id}/attachment")
    public ResponseEntity<ChangeRequestDto.Response> uploadAttachment(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(service.uploadAttachment(id, file));
    }

    @GetMapping("/{id}/attachment")
    public ResponseEntity<Resource> downloadAttachment(@PathVariable Long id) throws MalformedURLException {
        ChangeRequestDto.Response cr = service.findById(id);
        if (!cr.isHasAttachment()) return ResponseEntity.notFound().build();
        Resource resource = fileStorageService.load(id + "_" + cr.getAttachmentOriginalName());
        String encoded = URLEncoder.encode(cr.getAttachmentOriginalName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    @DeleteMapping("/{id}/attachment")
    public ResponseEntity<Void> deleteAttachment(@PathVariable Long id) {
        service.deleteAttachment(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
