package com.platform.portal.domain.todo.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class WorkLog {
    private String date;    // YYYY-MM-DD
    private String content;
}
