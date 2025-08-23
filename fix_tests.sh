#!/bin/bash

echo "Fixing test expectations to include totalTokensConsumed display..."

# Fix ccpet.test.ts
sed -i '' 's/(^_^) ●●●●●●●●●● 100\.00 (0) 💖0/(^_^) ●●●●●●●●●● 100.00 (0) 🔸0 💖0/g' src/__tests__/ccpet.test.ts
sed -i '' 's/(o_o) ●●●●●○○○○○ 50\.00 (0) 💖10/(o_o) ●●●●●○○○○○ 50.00 (0) 🔸10 💖10/g' src/__tests__/ccpet.test.ts
sed -i '' 's/(o_o) ●●●○○○○○○○ 30\.00 (150) 💖150/(o_o) ●●●○○○○○○○ 30.00 (150) 🔸150 💖150/g' src/__tests__/ccpet.test.ts
sed -i '' 's/(o_o) ●●●●●○○○○○ 50\.00 (0) 💖0/(o_o) ●●●●●○○○○○ 50.00 (0) 🔸0 💖0/g' src/__tests__/ccpet.test.ts
sed -i '' 's/(^_^) ●●●●●●●●●● 97\.00 (0) 💖2\.00M/(^_^) ●●●●●●●●●● 97.00 (0) 🔸2.00M 💖2.00M/g' src/__tests__/ccpet.test.ts
sed -i '' 's/(o_o) ●●●●●○○○○○ 50\.00 (500\.0K) 💖1\.00M/(o_o) ●●●●●○○○○○ 50.00 (500.0K) 🔸1.00M 💖1.00M/g' src/__tests__/ccpet.test.ts
sed -i '' 's/(o_o) ●●●●○○○○○○ 40\.00 (100) 💖100/(o_o) ●●●●○○○○○○ 40.00 (100) 🔸100 💖100/g' src/__tests__/ccpet.test.ts
sed -i '' 's/(^_^) ●●●●●●●●●● 100\.00 (3) 💖3/(^_^) ●●●●●●●●●● 100.00 (3) 🔸3 💖3/g' src/__tests__/ccpet.test.ts

# Fix PetIntegration.test.ts
sed -i '' 's/(^_^) ●●●●●●●●●● 100\.00 (0) 💖1\.00M/(^_^) ●●●●●●●●●● 100.00 (0) 🔸1.00M 💖1.00M/g' src/__tests__/integration/PetIntegration.test.ts
sed -i '' 's/(o_o) ●●●●●○○○○○ 50\.00 (500\.0K) 💖500\.0K/(o_o) ●●●●●○○○○○ 50.00 (500.0K) 🔸500.0K 💖500.0K/g' src/__tests__/integration/PetIntegration.test.ts
sed -i '' 's/(^_^) ●●●●●●●●●● 100\.00 (0) 💖0/(^_^) ●●●●●●●●●● 100.00 (0) 🔸0 💖0/g' src/__tests__/integration/PetIntegration.test.ts
sed -i '' 's/(^_^) ●●●●●●●●●● 100\.00 (3) 💖3/(^_^) ●●●●●●●●●● 100.00 (3) 🔸3 💖3/g' src/__tests__/integration/PetIntegration.test.ts

echo "Test fixes applied!"