allprojects {
	repositories {
		gradlePluginPortal()
		mavenCentral()
	}

	group = "fhv.omni"
	version = "0.3.0"
}

plugins {
	id("org.sonarqube") version "6.2.0.5505"
}

sonar {
	properties {
		property("sonar.projectKey", "omni6961018_Omni")
		property("sonar.organization", "omni6961018")
	}
}
