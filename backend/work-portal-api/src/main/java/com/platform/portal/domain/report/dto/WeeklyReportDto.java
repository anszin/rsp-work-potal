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
        private String accomplishments;
        private String plans;
        private String issues;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final String title;
        private final LocalDate weekStart;
        private final LocalDate weekEnd;
        private final String accomplishments;
        private final String plans;
        private final String issues;
        private final String author;
        private final LocalDateTime createdAt;

        public Response(WeeklyReport r) {
            this.id = r.getId();
            this.title = r.getTitle();
            this.weekStart = r.getWeekStart();
            this.weekEnd = r.getWeekEnd();
            this.accomplishments = r.getAccomplishments();
            this.plans = r.getPlans();
            this.issues = r.getIssues();
            this.author = r.getAuthor();
            this.createdAt = r.getCreatedAt();
        }
    }
}
