package com.platform.portal.domain.deploy.dto;

import com.platform.portal.domain.deploy.entity.DeployStep;
import lombok.Getter;

import java.time.LocalDateTime;

public class DeployStepDto {

    @Getter
    public static class Response {
        private final Long id;
        private final String serverName;
        private final int stepOrder;
        private final DeployStep.StepStatus status;
        private final String completedBy;
        private final LocalDateTime completedAt;

        public Response(DeployStep step) {
            this.id = step.getId();
            this.serverName = step.getServerName();
            this.stepOrder = step.getStepOrder();
            this.status = step.getStatus();
            this.completedBy = step.getCompletedBy();
            this.completedAt = step.getCompletedAt();
        }
    }

    @Getter
    public static class CompleteResult {
        private final Response step;
        private final boolean allCompleted;

        public CompleteResult(Response step, boolean allCompleted) {
            this.step = step;
            this.allCompleted = allCompleted;
        }
    }
}
