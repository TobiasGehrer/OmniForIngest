package fhv.omni.auth.controller;

import fhv.omni.auth.controller.model.AuthenticationRequest;
import fhv.omni.auth.controller.model.RegistrationRequest;
import fhv.omni.auth.service.RegistrationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
public class AuthenticationController {

    private final RegistrationService registrationService;
    private final AuthenticationManager authenticationManager;

    @Autowired
    public AuthenticationController(RegistrationService registrationService, AuthenticationManager authenticationManager) {
        this.registrationService = registrationService;
        this.authenticationManager = authenticationManager;
    }

    @PostMapping(value = "/login", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> login(HttpServletRequest request, HttpServletResponse response,
                                                     @Valid @RequestBody AuthenticationRequest authRequest) {
        try {
            UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(
                    authRequest.username(),
                    authRequest.password()
            );

            Authentication authentication = authenticationManager.authenticate(authenticationToken);

            SecurityContextHolder.getContext().setAuthentication(authentication);

            HttpSession session = request.getSession(true);
            session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
                    SecurityContextHolder.getContext());

            log.info("Login successful for user: {}, session ID: {}", authRequest.username(), session.getId());
            return ResponseEntity.ok()
                    .header("X-Auth-Token", session.getId())
                    .body(Map.of("message", "Login successful"));
        } catch (AuthenticationException e) {
            log.warn("Login failed for user '{}': {}", authRequest.username(), e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Login failed: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/register", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> register(@Valid @RequestBody RegistrationRequest request) {
        if (!request.password().equals(request.passwordConfirm())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Passwords do not match"));
        }

        registrationService.register(request.email(), request.username(), request.password());

        return ResponseEntity.ok(Map.of("message", "Registration Successful")); // TODO: Use standard response builder for success messages
    }

    @RequestMapping(value = "/logout", method = {RequestMethod.POST, RequestMethod.GET})
    public ResponseEntity<String> logout(HttpServletRequest request) {
        //TODO: implement
        return ResponseEntity.badRequest().body("Not yet implemented");
    }

    @GetMapping("/authenticated") // Example endpoint for authenticated users
    public String testAuthentication() {
        return "You are authenticated";
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, String>> me() {
        Map<String, String> response = new HashMap<>(); // TODO: Use internal response builder once available
        response.put("username", SecurityContextHolder.getContext().getAuthentication().getName());
        return ResponseEntity.ok(response);
    }
}
