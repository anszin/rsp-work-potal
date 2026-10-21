package com.platform.portal.api;

import com.platform.portal.domain.report.dto.WeeklyReportDto;
import com.platform.portal.domain.report.service.WeeklyReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/weekly-reports")
@RequiredArgsConstructor
public class WeeklyReportController {

    private final WeeklyReportService service;

    @GetMapping
    public List<WeeklyReportDto.Response> list(@AuthenticationPrincipal UserDetails user) {
        return service.findAll(user.getUsername());
    }

    @GetMapping("/{id}")
    public WeeklyReportDto.Response get(@PathVariable Long id, @AuthenticationPrincipal UserDetails user) {
        return service.findById(id, user.getUsername());
    }

    @GetMapping("/by-week")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public List<WeeklyReportDto.Response> byWeek(@RequestParam String weekStart) {
        return service.findByWeek(LocalDate.parse(weekStart));
    }

    @GetMapping("/consolidated")
    public List<WeeklyReportDto.Response> listConsolidated() {
        return service.findAllConsolidated();
    }

    @PostMapping
    public WeeklyReportDto.Response create(
            @Valid @RequestBody WeeklyReportDto.SaveRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return service.create(req, user.getUsername());
    }

    @PostMapping("/consolidated")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public WeeklyReportDto.Response createConsolidated(
            @Valid @RequestBody WeeklyReportDto.SaveRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return service.createConsolidated(req, user.getUsername());
    }

    @PutMapping("/{id}")
    public WeeklyReportDto.Response update(
            @PathVariable Long id,
            @Valid @RequestBody WeeklyReportDto.SaveRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return service.update(id, req, user.getUsername());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal UserDetails user) {
        service.delete(id, user.getUsername());
        return ResponseEntity.noContent().build();
    }
}
