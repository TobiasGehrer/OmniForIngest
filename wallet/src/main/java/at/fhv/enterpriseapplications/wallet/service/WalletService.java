package at.fhv.enterpriseapplications.wallet.service;

import at.fhv.enterpriseapplications.wallet.dto.WalletDto;
import at.fhv.enterpriseapplications.wallet.entity.Wallet;
import at.fhv.enterpriseapplications.wallet.repository.WalletRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class WalletService {

    private final WalletRepository walletRepository;

    public WalletDto getWallet(String username) {
        Optional<Wallet> wallet = walletRepository.findByUsername(username);

        if (wallet.isPresent()) {
            return new WalletDto(wallet.get().getUsername(), wallet.get().getCoins());
        } else {
            // Create wallet if it doesn't exist
            Wallet newWallet = createWallet(username);
            return new WalletDto(newWallet.getUsername(), newWallet.getCoins());
        }
    }

    @Transactional
    public Wallet createWallet(String username) {
        if (walletRepository.existsByUsername(username)) {
            return walletRepository.findByUsername(username).orElseThrow();
        }

        Wallet wallet = new Wallet(username);
        Wallet savedWallet = walletRepository.save(wallet);
        log.info("Created new wallet for user: {} with 0 coins", username);
        return savedWallet;
    }

    @Transactional
    public WalletDto addCoins(String username, Integer amount) {
        if (amount < 0) {
            throw new IllegalArgumentException("Cannot add negative coins");
        }

        Wallet wallet = walletRepository.findByUsername(username)
                .orElseGet(() -> createWallet(username));

        wallet.setCoins(wallet.getCoins() + amount);

        Wallet savedWallet = walletRepository.save(wallet);

        log.info("Added {} coins to {}'s wallet. New total: {}", amount, username, savedWallet.getCoins());

        return new WalletDto(savedWallet.getUsername(), savedWallet.getCoins());
    }

    public Integer getCoins(String username) {
        return walletRepository.findByUsername(username)
                .map(Wallet::getCoins)
                .orElse(0);
    }
}
