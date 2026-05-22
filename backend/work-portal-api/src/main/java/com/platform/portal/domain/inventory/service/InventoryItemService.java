package com.platform.portal.domain.inventory.service;

import com.platform.portal.domain.inventory.dto.InventoryItemDto;
import com.platform.portal.domain.inventory.entity.InventoryItem;
import com.platform.portal.domain.inventory.repository.InventoryItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InventoryItemService {

    private final InventoryItemRepository repository;

    public List<InventoryItemDto.Response> findAll(InventoryItem.ItemType type) {
        List<InventoryItem> items = type != null
                ? repository.findByTypeOrderByCreatedAtDesc(type)
                : repository.findAllByOrderByCreatedAtDesc();
        return items.stream().map(InventoryItemDto.Response::new).toList();
    }

    public InventoryItemDto.Response findById(Long id) {
        return repository.findById(id)
                .map(InventoryItemDto.Response::new)
                .orElseThrow(() -> new IllegalArgumentException("Item not found: " + id));
    }

    @Transactional
    public InventoryItemDto.Response create(InventoryItemDto.SaveRequest req) {
        InventoryItem item = new InventoryItem();
        apply(item, req);
        return new InventoryItemDto.Response(repository.save(item));
    }

    @Transactional
    public InventoryItemDto.Response update(Long id, InventoryItemDto.SaveRequest req) {
        InventoryItem item = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Item not found: " + id));
        apply(item, req);
        return new InventoryItemDto.Response(item);
    }

    @Transactional
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private void apply(InventoryItem item, InventoryItemDto.SaveRequest req) {
        item.setType(req.getType());
        item.setName(req.getName());
        item.setClient(req.getClient());
        item.setAmount(req.getAmount());
        item.setStatus(req.getStatus() != null ? req.getStatus() : InventoryItem.ItemStatus.ACTIVE);
        item.setStartDate(req.getStartDate());
        item.setEndDate(req.getEndDate());
        item.setNote(req.getNote());
    }
}
