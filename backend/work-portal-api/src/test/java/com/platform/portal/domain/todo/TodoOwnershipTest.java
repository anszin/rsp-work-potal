package com.platform.portal.domain.todo;

import com.platform.portal.domain.todo.entity.Todo;
import com.platform.portal.domain.todo.repository.TodoRepository;
import com.platform.portal.domain.user.entity.User;
import com.platform.portal.support.AuthTestSupport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** F-AUTH-001 R-003 — To-Do 소유자(담당자·협업자) 검사. 현행: 누구나 수정·삭제 가능. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class TodoOwnershipTest extends AuthTestSupport {

    @Autowired MockMvc mvc;
    @Autowired TodoRepository repository;

    private static final String BODY = "{\"title\":\"수정된 할 일\"}";

    @Test
    @DisplayName("협업자는 수정할 수 있다 (200)")
    void collaboratorCanUpdate() throws Exception {
        User a = user("td-a", User.Role.MEMBER);
        User c = user("td-c", User.Role.MEMBER);
        Todo t = todo(a.getUsername(), List.of(c.getUsername()));

        mvc.perform(put("/api/todos/" + t.getId()).header("Authorization", bearer(c))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("무관한 MEMBER 는 수정할 수 없다 (403)")
    void strangerCannotUpdate() throws Exception {
        User a = user("td-a2", User.Role.MEMBER);
        User b = user("td-b2", User.Role.MEMBER);
        Todo t = todo(a.getUsername(), List.of());

        mvc.perform(put("/api/todos/" + t.getId()).header("Authorization", bearer(b))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("무관한 MEMBER 는 삭제할 수 없다 (403)")
    void strangerCannotDelete() throws Exception {
        User a = user("td-a3", User.Role.MEMBER);
        User b = user("td-b3", User.Role.MEMBER);
        Todo t = todo(a.getUsername(), List.of());

        mvc.perform(delete("/api/todos/" + t.getId()).header("Authorization", bearer(b)))
                .andExpect(status().isForbidden());
    }

    private Todo todo(String assignee, List<String> collaborators) {
        Todo t = new Todo();
        t.setTitle("할 일");
        t.setAssignee(assignee);
        t.setCollaborators(collaborators);
        return repository.saveAndFlush(t);
    }
}
