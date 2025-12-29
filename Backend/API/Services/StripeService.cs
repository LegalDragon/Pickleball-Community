using Stripe;

namespace Pickleball.College.Services;

public class StripeService : IStripeService
{
    public StripeService(IConfiguration configuration)
    {
        StripeConfiguration.ApiKey = configuration["Stripe:SecretKey"];
    }

    public async Task<PaymentIntent> CreatePaymentIntentAsync(decimal amount, string description)
    {
        var options = new PaymentIntentCreateOptions
        {
            Amount = (long)(amount * 100), // Convert to cents
            Currency = "usd",
            Description = description,
            AutomaticPaymentMethods = new PaymentIntentAutomaticPaymentMethodsOptions
            {
                Enabled = true,
            },
        };

        var service = new PaymentIntentService();
        return await service.CreateAsync(options);
    }

    public async Task<string> CreateCoachAccountAsync(string email)
    {
        var options = new AccountCreateOptions
        {
            Type = "express",
            Email = email,
            Capabilities = new AccountCapabilitiesOptions
            {
                Transfers = new AccountCapabilitiesTransfersOptions { Requested = true },
            },
        };

        var service = new AccountService();
        var account = await service.CreateAsync(options);
        return account.Id;
    }

    public async Task<bool> ProcessPayoutAsync(string coachStripeAccountId, decimal amount)
    {
        try
        {
            var options = new TransferCreateOptions
            {
                Amount = (long)(amount * 100),
                Currency = "usd",
                Destination = coachStripeAccountId,
            };

            var service = new TransferService();
            await service.CreateAsync(options);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
