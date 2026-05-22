package com.platform.portal.domain.inventory.repository;

import com.platform.portal.domain.inventory.entity.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {
    List<InventoryItem> findByTypeOrderByCreatedAtDesc(InventoryItem.ItemType type);
    List<InventoryItem> findAllByOrderByCreatedAtDesc();
}
