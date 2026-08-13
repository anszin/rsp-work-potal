package com.platform.portal.api;

import com.platform.portal.domain.workunit.dto.WorkUnitDto;
import com.platform.portal.domain.workunit.service.WorkUnitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/work-units")
@RequiredArgsConstructor
public class WorkUnitController {

    private final WorkUnitService service;

    @GetMapping
    public List<WorkUnitDto.Response> list(@RequestParam Long keyTaskId) {
        return service.findByKeyTask(keyTaskId);
    }

    @PostMapping
    public WorkUnitDto.Response create(@Valid @RequestBody WorkUnitDto.SaveRequest req) {
        return service.create(req);
    }

    @PutMapping("/{id}")
    public WorkUnitDto.Response update(@PathVariable Long id, @Valid @RequestBody WorkUnitDto.SaveRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
