# CURSUS — Création du raccourci épinglable (v2)
# ==================================================
# La cible pointe vers cmd.exe (un vrai exécutable), qui lance ensuite
# le .bat en arrière-plan. C'est ce qui débloque l'option "Épingler à
# la barre des tâches", absente pour les raccourcis pointant directement
# vers un .bat dans Windows 11.

$Bureau = [Environment]::GetFolderPath("Desktop")
$CheminRaccourci = Join-Path $Bureau "Cursus.lnk"
$CheminBat = "D:\Dropbox\AA -Ecriture\Atelier d'écrivain\atelier-supabase\atelier-ecrivain\Lancer-Cursus.bat"
$CheminIcone = "D:\Dropbox\AA -Ecriture\Atelier d'écrivain\atelier-supabase\atelier-ecrivain\cursus.ico"
$DossierTravail = "D:\Dropbox\AA -Ecriture\Atelier d'écrivain\atelier-supabase\atelier-ecrivain"

$WshShell = New-Object -ComObject WScript.Shell
$Raccourci = $WshShell.CreateShortcut($CheminRaccourci)

# La cible est cmd.exe lui-même — c'est ça qui rend le raccourci épinglable.
$Raccourci.TargetPath = "$env:SystemRoot\System32\cmd.exe"
$Raccourci.Arguments = "/c start `"`" /min `"$CheminBat`""
$Raccourci.WorkingDirectory = $DossierTravail
$Raccourci.IconLocation = $CheminIcone
$Raccourci.Description = "Lancer Cursus"
$Raccourci.Save()

Write-Host "Raccourci créé sur le Bureau : $CheminRaccourci"
Write-Host ""
Write-Host "Étape suivante : clic droit sur l'icône Cursus sur le Bureau,"
Write-Host "puis choisir 'Épingler à la barre des tâches'."
Write-Host "(L'option devrait maintenant apparaître.)"
