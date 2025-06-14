package fhv.omni.auth.service;

import fhv.omni.auth.domain.*;
import fhv.omni.auth.entity.OmniUser;
import fhv.omni.auth.entity.Role;
import fhv.omni.auth.repo.OmniUserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.UUID;

@Service
public class RegistrationService {

    private final IValidateEmail emailValidator;
    private final IValidatePassword passwordValidator;
    private final IValidateUsername usernameValidator;
    private final PasswordEncoder passwordEncoder;
    private final OmniUserRepository omniUserRepository;

    @Autowired
    public RegistrationService(IValidateEmail emailValidator, IValidatePassword passwordValidator, IValidateUsername usernameValidator, PasswordEncoder passwordEncoder, OmniUserRepository omniUserRepository) {
        this.emailValidator = emailValidator;
        this.passwordValidator = passwordValidator;
        this.usernameValidator = usernameValidator;
        this.passwordEncoder = passwordEncoder;
        this.omniUserRepository = omniUserRepository;
    }

    public void register(String email, String username, String password) {
        if (email == null || username == null || password == null) {
            throw new IllegalArgumentException("Email, username or password cannot be null");
        }

        if (!emailValidator.isValidEmail(email)) {
            throw new IllegalArgumentException("Invalid email format");
        }

        try {
            passwordValidator.isValidPassword(password);
        } catch (PasswordDoesNotMeetRequirementsException e) {
            throw new IllegalArgumentException(e.getMessage(), e);
        }

        try {
            usernameValidator.validateUsername(username);
        } catch (UsernameMalformedException | UsernameLengthException e) {
            throw new IllegalArgumentException(e);
        }

        if (omniUserRepository.findByUsernameIgnoreCase(username).isPresent()) {
            throw new IllegalArgumentException("Username is already in use");
        }

        if (omniUserRepository.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("Email is already in use");
        }

        String hashedPassword = passwordEncoder.encode(password);

        OmniUser omniUser = new OmniUser(
                UUID.randomUUID().toString(),
                email,
                username,
                hashedPassword,
                Set.of(Role.USER) // USER role as standard for now
        );

        omniUserRepository.save(omniUser);
    }

}
