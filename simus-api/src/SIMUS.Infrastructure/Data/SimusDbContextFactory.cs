using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace SIMUS.Infrastructure.Data;

public sealed class SimusDbContextFactory : IDesignTimeDbContextFactory<SimusDbContext>
{
    public SimusDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";

        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var optionsBuilder = new DbContextOptionsBuilder<SimusDbContext>();

        var sqlServerConnectionString = DatabaseConnectionResolver.ResolveSqlServerConnectionString(configuration);
        if (string.IsNullOrWhiteSpace(sqlServerConnectionString))
        {
            // Design-time fallback only for local migration generation.
            sqlServerConnectionString = "Server=(localdb)\\MSSQLLocalDB;Database=SimusDesign;Trusted_Connection=True;TrustServerCertificate=True;";
        }

        optionsBuilder.UseSqlServer(sqlServerConnectionString, sql => sql.EnableRetryOnFailure(5));
        return new SimusDbContext(optionsBuilder.Options);
    }
}
