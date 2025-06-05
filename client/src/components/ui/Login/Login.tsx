import {useRef, useState} from 'react';
import './Login.css'
import useHoverSound from '../../../hooks/useHoverSound';

interface AuthFormProps {
    onAuthSuccess: () => void;
}

function Login({onAuthSuccess}: AuthFormProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        username: ''
    });
    const [error, setError] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const playHoverSound = useHoverSound();

    const handleChange = (e: {
        target: {
            name: any;
            value: any;
            validity: ValidityState;
        };
    }) => {
        const {
            name,
            value
        } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value
        }));

        // Clear error when user starts typing after validation
        if (isValidating) {
            checkValidity();
        }
    };

    const checkValidity = () => {
        if (!formRef.current) return;

        const form = formRef.current;
        const isValid = form.checkValidity();

        if (!isValid) {
            // Find the first invalid element
            const invalidElement = form.querySelector(':invalid') as HTMLInputElement;
            if (invalidElement) {
                let message = 'Please fill out all fields.';

                // For password mismatch, we need to handle it manually
                if (!isLogin &&
                    invalidElement.name === 'confirmPassword' &&
                    formData.password !== formData.confirmPassword) {
                    message = 'Passwords do not match';
                }

                setError(message);
                return false;
            }
        }

        setError('');
        return true;
    };

    const handleSubmit = async (e: {
        preventDefault: () => void;
    }) => {
        e.preventDefault();
        setIsValidating(true);

        // Additional custom validations
        if (!isLogin && formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (checkValidity()) {
            try {
                setIsSubmitting(true);
                setError('');

                const payload = {
                    username: formData.username,
                    password: formData.password,
                    ...(isLogin ? {} : {
                        email: formData.email,
                        passwordConfirm: formData.confirmPassword
                    }),
                };

                const endpoint = `http://localhost:8080/${isLogin ? 'login' : 'register'}`;

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                    credentials: 'include'
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => null);

                    throw new Error(
                        errorData?.message ||
                        `${isLogin ? 'Login' : 'Registration'} failed (${response.status})`
                    );
                }

                const data = await response.json();
                console.log('Authentication successful:', data);

                onAuthSuccess();

            } catch (err) {
                console.error('Authentication error:', err);
                setError(err instanceof Error ? err.message : 'An unexpected error occurred');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const toggleForm = () => {
        setIsLogin(!isLogin);
        setError('');
        setIsValidating(false);
    };

    return (
        <div className="login">
            <form
                ref={formRef}
                className="login__form"
                data-title={isLogin ? 'Login' : 'Register'}
                onSubmit={handleSubmit}
                noValidate
            >
                <div className="login__form-item">
                    <label htmlFor="username">Username</label>
                    <input
                        type="text"
                        id="username"
                        name="username"
                        required
                        value={formData.username}
                        onChange={handleChange}
                        aria-invalid={isValidating && !formData.username}
                        maxLength={20}
                    />
                </div>

                <div
                    className={`login__form-item login__form-item--email ${!isLogin ? 'login__form-item--visible' : ''}`}>
                    <label htmlFor="email">Email</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        tabIndex={isLogin ? -1 : 0}
                        required={!isLogin}
                        aria-invalid={isValidating && !isLogin && !formData.email}
                    />
                </div>

                <div className="login__form-item">
                    <label htmlFor="password">Password</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        required
                        value={formData.password}
                        onChange={handleChange}
                        aria-invalid={isValidating && !formData.password}
                    />
                </div>

                <div
                    className={`login__form-item login__form-item--confirm ${!isLogin ? 'login__form-item--visible' : ''}`}>
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        tabIndex={isLogin ? -1 : 0}
                        required={!isLogin}
                        aria-invalid={isValidating && !isLogin && (formData.password !== formData.confirmPassword)}
                    />
                </div>

                <div className={`login__error ${!error ? 'login__error--hidden' : ''}`}
                     role="alert"
                     aria-live="assertive">
                    {error}
                </div>

                <button
                    type="submit"
                    className="button"
                    variant="primary"
                    disabled={isSubmitting}
                    onMouseEnter={playHoverSound}
                >
                    {isSubmitting
                        ? (isLogin ? 'Logging in...' : 'Registering...')
                        : (isLogin ? 'Login' : 'Register')}
                </button>

                <button
                    type="button"
                    onClick={toggleForm}
                    className="login__register-toggle"
                    disabled={isSubmitting}
                    onMouseEnter={playHoverSound}
                >
                    {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
                </button>
            </form>
        </div>
    );
}

export default Login;
