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
        return service.findMine(user.getUsername());
    }

    @PostMapping
    public TodoDto.Response create(
            @Valid @RequestBody TodoDto.SaveRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return service.create(req, user.getUsername());
    }

    @PutMapping("/{id}")
    public TodoDto.Response update(
            @PathVariable Long id,
            @Valid @RequestBody TodoDto.SaveRequest req,
            @AuthenticationPrincipal UserDetails user) {
        return service.update(id, req, user.getUsername());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
