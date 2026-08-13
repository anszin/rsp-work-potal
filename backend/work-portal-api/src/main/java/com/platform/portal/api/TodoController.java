package com.platform.portal.api;

import com.platform.portal.domain.todo.dto.TodoDto;
import com.platform.portal.domain.todo.service.TodoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/todos")
@RequiredArgsConstructor
public class TodoController {

    private final TodoService service;

    @GetMapping
    public List<TodoDto.Response> list(@AuthenticationPrincipal UserDetails user) {
        boolean isManager = user.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_MANAGER"));
        return isManager ? service.findAll() : service.findMine(user.getUsername());
    }

    @PostMapping
    public TodoDto.Response create(
            @Valid @RequestBody TodoDto.SaveRequest req,
            @AuthenticationPrincipal UserDetails user) {
        boolean isManager = isManagerOrAdmin(user);
        String assignee = (isManager && req.getAssignee() != null && !req.getAssignee().isBlank())
                ? req.getAssignee() : user.getUsername();
        return service.create(req, assignee);
    }

    @PutMapping("/{id}")
    public TodoDto.Response update(
            @PathVariable Long id,
            @Valid @RequestBody TodoDto.SaveRequest req,
            @AuthenticationPrincipal UserDetails user) {
        boolean isManager = isManagerOrAdmin(user);
        String assignee = (isManager && req.getAssignee() != null && !req.getAssignee().isBlank())
                ? req.getAssignee() : null;
        return service.update(id, req, assignee);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    private boolean isManagerOrAdmin(UserDetails user) {
        return user.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_MANAGER"));
    }
}
