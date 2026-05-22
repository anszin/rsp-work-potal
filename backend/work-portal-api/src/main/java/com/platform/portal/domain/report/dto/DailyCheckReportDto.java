package com.platform.portal.domain.report.dto;

import com.platform.portal.domain.report.entity.DailyCheckReport;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class DailyCheckReportDto {

    @Getter
    @Setter
    public static class SaveRequest {
        @NotNull
        private Long systemId;
        @NotNull
        private LocalDate checkDate;
        @NotNull
        private DailyCheckReport.CheckStatus status;
        private String note;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final Long systemId;
        private final String systemName;
        private final LocalDate checkDate;
        private final DailyCheckReport.CheckStatus status;
        private final String note;
        private final String reporter;
        private final LocalDateTime createdAt;

        public Response(DailyCheckReport r) {
            this.id = r.getId();
            this.systemId = r.getSystem().getId();
            this.systemName = r.getSystem().getName();
            this.checkDate = r.getCheckDate();
            this.status = r.getStatus();
            this.note = r.getNote();
            this.reporter = r.getReporter();
            this.createdAt = r.getCreatedAt();
        }
    }
}
