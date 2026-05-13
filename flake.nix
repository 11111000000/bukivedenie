{
  description = "bukivedenie development shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/25.11";
  };

  outputs = { self, nixpkgs }: let
    pkgs = import nixpkgs { };
    devScript = pkgs.writeShellScriptBin "bukivedenie-dev" ''
      cd ${builtins.toString ./.}
      exec ${pkgs.bashInteractive}/bin/bash -lc 'python scripts/build_site_data.py --source outputs --target site/public/data && cd site && npm run dev'
    '';
    previewScript = pkgs.writeShellScriptBin "bukivedenie-preview" ''
      cd ${builtins.toString ./.}
      exec ${pkgs.bashInteractive}/bin/bash -lc 'python scripts/build_site_data.py --source outputs --target site/public/data && cd site && npm run preview'
    '';
    smokeScript = pkgs.writeShellScriptBin "bukivedenie-smoke" ''
      cd ${builtins.toString ./.}
      exec ${pkgs.bashInteractive}/bin/bash -lc 'python scripts/build_site_data.py --source outputs --target site/public/data && cd site && npm run build'
    '';
    shell = pkgs.mkShell {
      packages = with pkgs; [
        bashInteractive
        curl
        git
        gnumake
        nodejs_22
        python3
        python3Packages.pytest
        libreoffice
      ];

      shellHook = ''
        echo "Entered bukivedenie dev shell. Use: make site-install, make site-dev, make ui-smoke, pytest"
      '';
    };
  in {
    devShells.${pkgs.stdenv.hostPlatform.system}.default = shell;

    apps.${pkgs.stdenv.hostPlatform.system} = {
      dev = {
        type = "app";
        program = "${devScript}/bin/bukivedenie-dev";
      };
      preview = {
        type = "app";
        program = "${previewScript}/bin/bukivedenie-preview";
      };
      smoke = {
        type = "app";
        program = "${smokeScript}/bin/bukivedenie-smoke";
      };
      default = {
        type = "app";
        program = "${devScript}/bin/bukivedenie-dev";
      };
    };
  };
}
