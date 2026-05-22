package com.platform.portal.domain.inventory.dto;

import com.platform.portal.domain.inventory.entity.InventoryItem;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class InventoryItemDto {

    @Getter
    @Setter
    public static class SaveRequest {
        @NotNull
        private InventoryItem.ItemType type;
        @NotBlank
        private String name;
        private String client;
        private Long amount;
        private InventoryItem.ItemStatus status;
        private LocalDate startDate;
        private LocalDate endDate;
        private String note;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final InventoryItem.ItemType type;
        private final String name;
        private final String client;
        private final Long amount;
        private final InventoryItem.ItemStatus status;
        private final LocalDate startDate;
        private final LocalDate endDate;
        private final String note;
        private final LocalDateTime createdAt;

        public Response(InventoryItem item) {
            this.id = item.getId();
            this.type = item.getType();
            this.name = item.getName();
            this.client = item.getClient();
            this.amount = item.getAmount();
            this.status = item.getStatus();
            this.startDate = item.getStartDate();
            this.endDate = item.getEndDate();
            this.note = item.getNote();
            this.createdAt = item.getCreatedAt();
        }
    }
}
