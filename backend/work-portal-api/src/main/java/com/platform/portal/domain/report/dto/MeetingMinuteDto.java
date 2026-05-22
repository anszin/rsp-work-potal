package com.platform.portal.domain.report.dto;

import com.platform.portal.domain.report.entity.MeetingMinute;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class MeetingMinuteDto {

    @Getter
    @Setter
    public static class SaveRequest {
        @NotBlank
        private String title;
        @NotNull
        private LocalDate meetingDate;
        private String location;
        private String attendees;
        private String content;
        private String actionItems;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final String title;
        private final LocalDate meetingDate;
        private final String location;
        private final String attendees;
        private final String content;
        private final String actionItems;
        private final String author;
        private final LocalDateTime createdAt;

        public Response(MeetingMinute m) {
            this.id = m.getId();
            this.title = m.getTitle();
            this.meetingDate = m.getMeetingDate();
            this.location = m.getLocation();
            this.attendees = m.getAttendees();
            this.content = m.getContent();
            this.actionItems = m.getActionItems();
            this.author = m.getAuthor();
            this.createdAt = m.getCreatedAt();
        }
    }
}
