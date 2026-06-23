package com.platform.portal.domain.keytask.dto;

import com.platform.portal.domain.keytask.entity.KeyTask;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

public class KeyTaskDto {

    @Getter @Setter
    public static class SaveRequest {
        @NotNull private Integer year;
        private Long parentId;
        private String teamName;
        private String assigneeName;
        private String kpi;
        @NotBlank private String taskName;
        private String q1Plan, q2Plan, q3Plan, q4Plan;
        private String q1Result, q2Result, q3Result, q4Result;
        private String q1Achievement, q2Achievement, q3Achievement, q4Achievement;
        private String q1Reason, q2Reason, q3Reason, q4Reason;
        private Integer sortOrder;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final Integer year;
        private final Long parentId;
        private final String teamName;
        private final String assigneeName;
        private final String kpi;
        private final String taskName;
        private final String q1Plan, q2Plan, q3Plan, q4Plan;
        private final String q1Result, q2Result, q3Result, q4Result;
        private final String q1Achievement, q2Achievement, q3Achievement, q4Achievement;
        private final String q1Reason, q2Reason, q3Reason, q4Reason;
        private final Integer sortOrder;
        private final LocalDateTime createdAt;
        private final LocalDateTime updatedAt;

        public Response(KeyTask k) {
            this.id = k.getId();
            this.year = k.getYear();
            this.parentId = k.getParentId();
            this.teamName = k.getTeamName();
            this.assigneeName = k.getAssigneeName();
            this.kpi = k.getKpi();
            this.taskName = k.getTaskName();
            this.q1Plan = k.getQ1Plan(); this.q2Plan = k.getQ2Plan();
            this.q3Plan = k.getQ3Plan(); this.q4Plan = k.getQ4Plan();
            this.q1Result = k.getQ1Result(); this.q2Result = k.getQ2Result();
            this.q3Result = k.getQ3Result(); this.q4Result = k.getQ4Result();
            this.q1Achievement = k.getQ1Achievement(); this.q2Achievement = k.getQ2Achievement();
            this.q3Achievement = k.getQ3Achievement(); this.q4Achievement = k.getQ4Achievement();
            this.q1Reason = k.getQ1Reason(); this.q2Reason = k.getQ2Reason();
            this.q3Reason = k.getQ3Reason(); this.q4Reason = k.getQ4Reason();
            this.sortOrder = k.getSortOrder();
            this.createdAt = k.getCreatedAt();
            this.updatedAt = k.getUpdatedAt();
        }
    }
}
