package com.platform.portal.api;

import com.platform.portal.domain.report.dto.DailyCheckReportDto;
import com.platform.portal.domain.report.service.DailyCheckReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/daily-checks")
@RequiredArgsConstructor
public class DailyCheckReportController {

    private final DailyCheckReportService service;

    @GetMapping
    public List<DailyCheckReportDto.Response> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        if (date != null) return service.findByDate(date);
        return service.findAll();
    }

    @GetMapping("/{id}")
    public DailyCheckReportDto.Response get(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    public DailyCheckReportDto.Response create(
            @Valid @RequestBody DailyCheckReportDto.SaveRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return service.create(req, user.getUsername());
    }

    @PutMapping("/{id}")
    public DailyCheckReportDto.Response update(
            @PathVariable Long id,
            @Valid @RequestBody DailyCheckReportDto.SaveRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
