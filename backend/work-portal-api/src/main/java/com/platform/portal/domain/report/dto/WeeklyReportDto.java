package com.platform.portal.domain.report.dto;

import com.platform.portal.domain.report.entity.WeeklyReport;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class WeeklyReportDto {

    @Getter
    @Setter
    public static class SaveRequest {
        @NotBlank
        private String title;
        @NotNull
        private LocalDate weekStart;
        @NotNull
        private LocalDate weekEnd;
        private String thisWeekWork;
        private String thisWeekProposal;
        private String thisWeekEtc;
        private String nextWeekWork;
        private String nextWeekProposal;
        private String nextWeekEtc;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final String title;
        private final LocalDate weekStart;
        private final LocalDate weekEnd;
        private final String thisWeekWork;
        private final String thisWeekProposal;
        private final String thisWeekEtc;
        private final String nextWeekWork;
        private final String nextWeekProposal;
        private final String nextWeekEtc;
        private final String author;
        private final LocalDateTime createdAt;

        public Response(WeeklyReport r) {
            this.id = r.getId();
            this.title = r.getTitle();
            this.weekStart = r.getWeekStart();
            this.weekEnd = r.getWeekEnd();
            this.thisWeekWork = r.getThisWeekWork();
            this.thisWeekProposal = r.getThisWeekProposal();
            this.thisWeekEtc = r.getThisWeekEtc();
            this.nextWeekWork = r.getNextWeekWork();
            this.nextWeekProposal = r.getNextWeekProposal();
            this.nextWeekEtc = r.getNextWeekEtc();
            this.author = r.getAuthor();
            this.createdAt = r.getCreatedAt();
        }
    }
}
