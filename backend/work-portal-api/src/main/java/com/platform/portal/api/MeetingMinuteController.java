package com.platform.portal.api;

import com.platform.portal.domain.report.dto.MeetingMinuteDto;
import com.platform.portal.domain.report.service.MeetingMinuteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/meeting-minutes")
@RequiredArgsConstructor
public class MeetingMinuteController {

    private final MeetingMinuteService service;

    @GetMapping
    public List<MeetingMinuteDto.Response> list() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public MeetingMinuteDto.Response get(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    public MeetingMinuteDto.Response create(
            @Valid @RequestBody MeetingMinuteDto.SaveRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return service.create(req, user.getUsername());
    }

    @PutMapping("/{id}")
    public MeetingMinuteDto.Response update(
            @PathVariable Long id,
            @Valid @RequestBody MeetingMinuteDto.SaveRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
