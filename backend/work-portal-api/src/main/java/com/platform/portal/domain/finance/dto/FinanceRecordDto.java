package com.platform.portal.domain.finance.dto;

import com.platform.portal.domain.finance.entity.FinanceRecord;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

public class FinanceRecordDto {

    @Getter
    @Setter
    public static class SaveRequest {
        @NotNull
        private Integer year;
        @NotNull
        private Integer month;
        @NotNull
        private FinanceRecord.Category category;
        @NotBlank
        private String itemName;
        @NotNull
        private Long amount;
        private String note;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final int year;
        private final int month;
        private final FinanceRecord.Category category;
        private final String itemName;
        private final long amount;
        private final String note;
        private final LocalDateTime createdAt;

        public Response(FinanceRecord r) {
            this.id = r.getId();
            this.year = r.getYear();
            this.month = r.getMonth();
            this.category = r.getCategory();
            this.itemName = r.getItemName();
            this.amount = r.getAmount();
            this.note = r.getNote();
            this.createdAt = r.getCreatedAt();
        }
    }

    @Getter
    @AllArgsConstructor
    public static class MonthlySummary {
        private final int month;
        private final long revenue;
        private final long expense;
        private final long profit;
    }
}
