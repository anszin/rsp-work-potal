package com.platform.portal.api;

import com.platform.portal.domain.report.dto.WeeklyReportDto;
import com.platform.portal.domain.report.service.WeeklyReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/weekly-reports")
@RequiredArgsConstructor
public class WeeklyReportController {

    private final WeeklyReportService service;

    @GetMapping
    public List<WeeklyReportDto.Response> list() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public WeeklyReportDto.Response get(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    public WeeklyReportDto.Response create(
            @Valid @RequestBody WeeklyReportDto.SaveRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return service.create(req, user.getUsername());
    }

    @PutMapping("/{id}")
    public WeeklyReportDto.Response update(
            @PathVariable Long id,
            @Valid @RequestBody WeeklyReportDto.SaveRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
