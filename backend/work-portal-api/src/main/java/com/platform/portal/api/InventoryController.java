package com.platform.portal.api;

import com.platform.portal.domain.inventory.dto.InventoryItemDto;
import com.platform.portal.domain.inventory.entity.InventoryItem;
import com.platform.portal.domain.inventory.service.InventoryItemService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryItemService service;

    @GetMapping
    public List<InventoryItemDto.Response> list(
            @RequestParam(required = false) InventoryItem.ItemType type) {
        return service.findAll(type);
    }

    @GetMapping("/{id}")
    public InventoryItemDto.Response get(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    public InventoryItemDto.Response create(@Valid @RequestBody InventoryItemDto.SaveRequest req) {
        return service.create(req);
    }

    @PutMapping("/{id}")
    public InventoryItemDto.Response update(
            @PathVariable Long id,
            @Valid @RequestBody InventoryItemDto.SaveRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
